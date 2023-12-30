import { View, Text, SafeAreaView, Vibration, Image, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Dimensions } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { placeholder_image } from '../../globals/asstes'
import { useSelector } from 'react-redux'
import { RootState, useAppDispatch } from '../../redux/store'
import AntDesign from 'react-native-vector-icons/AntDesign'
import { NavigationProp, useNavigation } from '@react-navigation/native'
import { ProfileStacktype } from '../../navigations/ProfileStack'
import { FlatList } from 'react-native'
import { Thread } from '../../types/Post'
import ProfilePost from '../../components/profile/PofilePost'
import { DeletePostAction, FetchMoreUserPostsAction, FetchUserPostsAction, } from '../../redux/slices/UserSlice'
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import UseTheme from '../../globals/UseTheme'
import ProfileRepost from '../../components/profile/ProfileRepost'
import Loader from '../../components/global/Loader'
import { scaledFont } from '../../globals/utilities'
const { height, width } = Dimensions.get("window")
const Profile = () => {

  const user = useSelector((state: RootState) => state.User.user)
  const posts = useSelector((state: RootState) => state.User.Posts)
  const loading = useSelector((state: RootState) => state.User.loading)
  const screenLoading = useSelector((state: RootState) => state.User.screenLoading)
  const lastOffset = useSelector((state: RootState) => state.User.lastOffset)
  const morePostsLoading = useSelector((state: RootState) => state.User.morePostsLoading)
  const navigation = useNavigation<NavigationProp<ProfileStacktype, "Profile">>()
  const [selectedSection, setSelectedSection] = useState<"Thread" | "Repost">("Thread")
  const threeDotPressModalRef = useRef<BottomSheetModal>(null)
  const snapPoints = useMemo(() => ['30%'], []);
  const [postId, setPostId] = useState("")
  const { theme } = UseTheme()
  const handleThreedotPress = useCallback((postId: string) => {
    setPostId(postId)
    threeDotPressModalRef.current?.present()
  }, [])

  const onDeleteModalPress = async () => {
    threeDotPressModalRef.current?.close()
    await dispatch(DeletePostAction({ postId }))

  }
  const dispatch = useAppDispatch()
  const renderPosts = (item: Thread, index: number) => {
    return (
      item.Repost && item.isRepost ?
        <ProfileRepost
          post={item}
          onPressThreeDots={(postId: string) => handleThreedotPress(postId)}
        /> :
        <ProfilePost
          post={item}
          onPressThreeDots={(postId: string) => handleThreedotPress(postId)}
        />
    )
  }

  const loadMorePosts = async () => {
    dispatch(FetchMoreUserPostsAction({
      post_type: selectedSection
    }))
  }

  useEffect(() => {
    dispatch(FetchUserPostsAction({
      post_type: selectedSection
    }))
  }, [selectedSection])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background_color }]}>
        {screenLoading && <Loader />}
        <ScrollView
          stickyHeaderHiddenOnScroll
          stickyHeaderIndices={[2]}
          refreshControl={
            <RefreshControl
              tintColor={theme.text_color}
              refreshing={loading}
              onRefresh={() => {
                dispatch(FetchUserPostsAction({ post_type: selectedSection }))
              }}
            />
          }
          //  contentContainerStyle={{flex:1}}
          style={{
            flex: 1,
          }}>
          <View style={styles.headerContainer}>
            <AntDesign
              //onPress={() => navigation.navigate("Settings")}
              name='instagram'
              size={scaledFont(25)}
              color={theme.text_color}
              style={{ marginRight: 10 }}
            />
            <AntDesign
              onPress={() => navigation.navigate("Settings")}
              name='bars'
              size={scaledFont(25)}
              color={theme.text_color}
            />
          </View>
          <View style={styles.userInfoContainer}>
            <View style={styles.profileRowContainer}>
              <View>
                <Text style={[styles.txtFullname, { color: theme.text_color }]}>{user.fullname}</Text>
                <Text style={{
                  color: theme.text_color,
                  fontSize:scaledFont(15)
                }}>{user.username}</Text>
              </View>
              <Image
                source={user.profile_picture ? { uri: user.profile_picture } : placeholder_image}
                style={styles.imgProfile}
              />
            </View>
            <Text style={{ color: theme.text_color,fontSize:scaledFont(13) }} ellipsizeMode="tail" numberOfLines={10}>{user.bio}</Text>
            <Text style={{ color: theme.secondary_text_color, marginTop: 20,fontSize:scaledFont(12) }}>{user.followers} Followers</Text>
          </View>
          <View style={[styles.selectionSticky, {
            backgroundColor: theme.background_color
          }]}>
            <View style={styles.selectionRowContainer}>
              <TouchableOpacity
                onPress={() => setSelectedSection("Thread")}
                style={[styles.btnThreads, {
                  borderBottomWidth: (selectedSection == "Thread") ? 1 : 0,
                  borderColor: theme.text_color
                }]}
              >
                <Text style={{
                  fontSize: scaledFont(15),
                  color: theme.text_color
                }}>Threads</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedSection("Repost")}
                style={[styles.btnReposts, {
                  borderBottomWidth: (selectedSection == "Repost") ? 1 : 0,
                  borderColor: theme.text_color
                }]}
              >
                <Text style={{
                  fontSize: scaledFont(15),
                  color: theme.text_color
                }}>Reposts</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            style={styles.flatList}
            ListFooterComponent={() => morePostsLoading && <ActivityIndicator
              color={theme.text_color}
              size={20}
              animating
            />}
            data={posts}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => renderPosts(item, index)}
            onEndReachedThreshold={0.3}
            onEndReached={() =>lastOffset && loadMorePosts()}
          />
        </ScrollView>

      </SafeAreaView>
      <BottomSheetModalProvider>
        <BottomSheetModal
          ref={threeDotPressModalRef}
          snapPoints={snapPoints}
          handleIndicatorStyle={[styles.sheetHandleIndicator, { backgroundColor: theme.text_color }]}
          handleStyle={[styles.sheetHandle, { backgroundColor: theme.secondary_background_color }]}
          backgroundStyle={{ backgroundColor: theme.background_color }}
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.secondary_background_color, }]}>
            <TouchableOpacity
              onPress={() => onDeleteModalPress()}
              style={[styles.btnDelete, { backgroundColor: theme.secondary_color, }]}>
              <Text style={styles.txtDelete}>Delete Thread</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => threeDotPressModalRef.current?.close()}
              style={[styles.btnEdit, { backgroundColor: theme.secondary_color, }]}>
              <Text
                style={[styles.textEdit, { color: theme.text_color, }]}
              >Cancel</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetModal>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}
export default Profile
const styles = StyleSheet.create({
  headerContainer:
  {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'flex-end'
  },
  container:
  {
    flex: 1,
  },
  userInfoContainer:
  {
    padding: 20,
  },
  profileRowContainer:
  {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  txtFullname:
  {
    fontSize: scaledFont(20),
    fontWeight: "bold",
  },
  imgProfile:
  {
    height: scaledFont(70),
    width: scaledFont(70),
    borderRadius: scaledFont(70)
  },
  selectionRowContainer:
  {
    flexDirection: "row",
    justifyContent: 'space-between'
  },
  btnThreads:
  {
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: "50%",
    justifyContent: "center",
    alignItems: "center",
  },
  btnReposts:
  {
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: "50%",
    justifyContent: "center",
    alignItems: "center",
  },
  flatList:
  {
    flex: 1
    ///padding: 10
  },
  selectionSticky:
    { marginTop: 10 },
  modalContainer:
  {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnEdit:
  {
    padding: 20,
    width: "100%",
    borderRadius: 10,
    marginVertical: 5
  },
  textEdit:
  {
    fontSize: 15,
    fontWeight: "bold"
  },
  btnDelete:
  {
    padding: 20,
    borderRadius: 10,
    width: "100%",
  },
  txtDelete:
  {
    color: "red",
    fontSize: scaledFont(15),
    fontWeight: "bold"
  },
  sheetHandle:
  {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  sheetHandleIndicator:
  {
    borderRadius: 15,
  }
})