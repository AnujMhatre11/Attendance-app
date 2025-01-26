import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchStudentInfo, getActiveSessionsForStudent } from '../api/useGetData';
import { UUIDContext } from '../context/uuidContext';
import { useLocalSearchParams, useSearchParams } from 'expo-router/build/hooks';

const StudentView = () => {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { uuidParam } = useLocalSearchParams();
  
  useEffect(() => {
    console.log("uuidParam: ",uuidParam);
  }, [uuidParam])

  useEffect(() => {
    const fetchData = async () => {
      // Add a guard to ensure UUID is not null or undefined
        console.log("Fetching student side info with uuid: ", uuidParam)
        const info = await fetchStudentInfo(uuidParam);
        setStudentInfo(info || null);
    };
    fetchData();
  }, [uuidParam]);;

  const fetchActiveSessions = useCallback(async () => {
    if (studentInfo) {
      const sessions = await getActiveSessionsForStudent(studentInfo);
      setActiveSessions(sessions || []);
    }
  }, [studentInfo]);

  useEffect(() => {
    fetchActiveSessions();
  }, [fetchActiveSessions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchActiveSessions();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSessionClick = (session) => {
    console.log("Pushing Data ", "faculty id: ", session.faculty_user_id, "subject id: ", session.subject_id, "Student uuid from student view :", studentInfo.user_id);
    router.push({
      pathname: '/components/StudentMarkingAttendance',
      params: {
        sessionId: session.session_id,
        facultyUuid: session.faculty_user_id,
        subjectName: session.subject.subject_name,
        subjectID: session.subject_id,
        student_uuid: studentInfo.user_id,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Active Attendance Sessions</Text>
      </View>

      {activeSessions.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.noSessionsContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <Text style={styles.noSessions}>No active attendance sessions</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={activeSessions}
          keyExtractor={(item) => item.session_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.sessionCard}
              onPress={() => handleSessionClick(item)}
            >
              <Text style={styles.subjectName}>{item.subject.subject_name}</Text>
              <Text style={styles.sessionDetails}>
                {`Started at: ${new Date(item.start_time).toLocaleTimeString()}`}
              </Text>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}

      <Text style={styles.swipeMessage}>Swipe down to refresh</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f9f9f9' },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  noSessionsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noSessions: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 20 },
  sessionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  subjectName: { fontSize: 18, fontWeight: 'bold' },
  sessionDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  swipeMessage: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default StudentView;
