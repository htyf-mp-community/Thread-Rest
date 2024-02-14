import mongoose, { Schema, mongo } from "mongoose";
import { CustomRequest } from "../middlewares/jwtTokenAuth";
import Message from "../models/Message";
import { Response } from "express";
import { io, usersMap } from "../../index";
import { v4 as uuidv4 } from "uuid";
import { getSignedUrl, uploadToS3 } from "../utilities/S3Utils";
import { generateThumbnail } from "../utilities/Thumbnail";
import Channel from "../models/Channel";
import { UserDocument } from "../types/User";
import { MessageDocument } from "../types/Message";
const sendMessage = async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.userId
        const content = req.body.content
        const receiverId = req.params.receiverId
        const media = req.files as Express.Multer.File[]

        if (!media && !content) {
            return res.status(400).json({
                message: "Invalid params"
            })
        }

        let channel = await Channel.findOne({
            $and: [
                { 'members.user': userId },
                { 'members.user': receiverId }
            ]
        });
        if (!channel) {
            const newChannel = new Channel({
                members: [
                    { user: userId, unread_count: 0 },
                    { user: receiverId, unread_count: 0 }
                ]
            });
            channel = newChannel;
            await newChannel.save();
        }

        type mediaType = {
            media_type: string,
            media_url: string,
            thumbnail?: string
        }
        const files: mediaType[] = []
        for (const file of media) {
            const { mimetype } = file;
            const extention = mimetype.split("/")[1]
            const filename = uuidv4() + "." + extention
            const filePath = "messages" + "/" + userId + "/" + receiverId + "/" + filename
            const result = await uploadToS3(file, filePath)
            const media: mediaType = {
                media_type: mimetype,
                media_url: result?.Key || "",
            }
            if (mimetype.includes("video")) {
                const thumbnailName = uuidv4() + ".jpeg"
                const thumbnailPath = "messages" + "/" + userId + "/" + receiverId + "/" + thumbnailName
                const thumbnail = await generateThumbnail(file, thumbnailPath)
                media.thumbnail = thumbnail.Key
            }
            files.push(media)
        }
        const message = new Message({
            content: content,
            sender: new mongoose.Types.ObjectId(userId),
            receiver: new mongoose.Types.ObjectId(receiverId),
            media: files
        })

        const messageRespnse = await message.save()
        const messageTochannel = message

        if (messageTochannel.media && messageTochannel.media.length > 0) {
            for (const mediaFile of messageTochannel.media) {
                mediaFile.media_url = await getSignedUrl(mediaFile.media_url);
                if (mediaFile.thumbnail) {
                    mediaFile.thumbnail = await getSignedUrl(mediaFile.thumbnail);
                }
            }
        }
        if (userId && usersMap.has(userId)) {
            const socketId = usersMap.get(userId)?.socketId
            if (socketId)
                io.to(socketId).emit("newMessage", messageTochannel)
        }
        if (usersMap.has(receiverId)) {
            const socketId = usersMap.get(receiverId)?.socketId
            if (socketId)
                io.to(socketId).emit("newMessage", messageTochannel)
            else {
                const index = channel.members.findIndex(element => element.user.equals(new mongoose.Types.ObjectId(receiverId)));
                if (index != -1) {
                    console.log("reciever is offline 2")
                    await channel.updateOne(
                        { $inc: { [`members.${index}.unread_count`]: 1 } }
                    );
                }
            }
        }
        else {
            const index = channel.members.findIndex(element => element.user.equals(new mongoose.Types.ObjectId(receiverId)));
            if (index != -1) {
                console.log("reciever is offline 2")
                await channel.updateOne(
                    { $inc: { [`members.${index}.unread_count`]: 1 } }
                );
            }
        }

        await channel.updateOne({
            lastMessage: messageRespnse._id
        })
        return res.status(201).json({
            message: "Message sent successFully"
        });
    }
    catch (err) {
        return res.status(500).json({
            message: err
        })
    }
}

const getMessages = async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.userId
        const lastOffset = req.query.lastOffset as string
        const pageSizeParam = req.query.pageSize as string;
        const pageSize = parseInt(pageSizeParam, 10) || 10;
        const receiverId = req.params.receiverId

        let query: any = {
            $or: [
                { sender: new mongoose.Types.ObjectId(userId), receiver: new mongoose.Types.ObjectId(receiverId) },
                { sender: new mongoose.Types.ObjectId(receiverId), receiver: new mongoose.Types.ObjectId(userId) }
            ]
        }
        if (lastOffset) {
            query._id = { $lt: new mongoose.Types.ObjectId(lastOffset) }
        }

        const conversations = await Message.find(query)
            .sort({ created_at: -1, _id: -1 })
            .limit(pageSize);

        await Promise.all(conversations.map(async (message) => {
            if (message.media && message.media.length > 0) {
                for (const mediaFile of message.media) {
                    mediaFile.media_url = await getSignedUrl(mediaFile.media_url);
                    if (mediaFile.thumbnail) {
                        mediaFile.thumbnail = await getSignedUrl(mediaFile.thumbnail);
                    }
                }
            }
        }))

        return res.status(200).json({
            data: conversations,
            meta: {
                pageSize: pageSize,
                lastOffset: conversations.length >= pageSize ?
                    conversations[conversations.length - 1]._id : null
            }
        })
    }
    catch (err) {

        return res.status(500).json({
            message: err
        })
    }
}

const getChannels = async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.userId
        const channels = await Channel.find({
            members: {
                $elemMatch: {
                    user: new mongoose.Types.ObjectId(userId)
                }
            }
        }).populate<{ members: { user: UserDocument, unread_count: Number }[] }>({
            path: 'members.user',
            model: 'User'
        }).populate<{ lastMessage: MessageDocument }>({
            path: "lastMessage",
            model: "Message"
        })

        await Promise.all(channels.map(async (channel) => {
            for (const member of channel.members) {
                if (member.user.profile_picture)
                    member.user.profile_picture = await getSignedUrl(member.user.profile_picture)
            }
        }))

        return res.status(200).json({
            data: channels
        })
    }
    catch (err) {
        return res.status(500).json({
            message: err
        })
    }
}

const readAllMessages = async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.userId
        const receiverId = req.params.receiverId
        const channel = await Channel.findOneAndUpdate(
            {
                $and: [
                    { 'members.user': userId },
                    { 'members.user': receiverId }
                ]
            },
            { $set: { 'members.$[elem].unread_count': 0 } },
            {
                new: true,
                arrayFilters: [{ 'elem.user': userId }]
            }
        );

        if (!channel) {
            return res.status(404).json({ message: 'Channel not found.' });
        }

        console.log("success to unread")

        return res.status(200).json({ message: 'All messages marked as read for channel.' });

    }
    catch (err: any) {
        return res.status(500).json({
            message: err
        })
    }
}


export default {
    sendMessage,
    getMessages,
    readAllMessages,
    getChannels
}
