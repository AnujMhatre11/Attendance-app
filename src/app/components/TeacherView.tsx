  import React, { useContext, useEffect, useState } from 'react';
  import { FlatList, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
  import { useRouter } from 'expo-router';
  import { UserContext } from '../context/UserContext';
  import { fetchFacultyInfo, getTeacherSubjects } from '../api/useGetData';

  const TeacherView = () => {
    const router = useRouter();
    const { user } = useContext(UserContext);
    const [facultyInfo, setFacultyInfo] = useState(null);
    const [subjects, setSubjects] = useState([]);

    useEffect(() => {
      const fetchData = async () => {
        const info = await fetchFacultyInfo();
        setFacultyInfo(info || null);
        console.log("faculty info :",info);
        
        const subjectsData = await getTeacherSubjects(info?.faculty_id);
        setSubjects(subjectsData || []);
      };
      fetchData();
    }, [user]);

    const handleSessionClick = (subject) => {
      if (!facultyInfo?.user_id) {
        console.error('No user ID found for faculty');
        return;
      }

      
      router.push({
        pathname: '/components/MarkAttendance',
        params: {
          facultyId: facultyInfo.faculty_id,
          uuid: facultyInfo.user_id, // Use user_id instead of faculty_id
          subjectId: subject.subject_id,
          courseName: subject.subject_name,
          branch: subject.branch,
          semester: subject.semester,
          division: subject.division,
          batch: subject.batch,
        },
      });
    };
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Your Subjects</Text>
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.sem_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.subjectCard}
              onPress={() => handleSessionClick(item)}
            >
              <Text style={styles.subjectName}>{item.subject_name}</Text>
              <Text style={styles.subjectDetails}>
                {`${item.branch} - Sem ${item.semester} - Div ${item.division} - Batch ${item.batch}`}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  export default TeacherView;

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f9f9f9' },
    header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
    subjectCard: {
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 8,
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    subjectName: { fontSize: 18, fontWeight: 'bold' },
    subjectDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  });
