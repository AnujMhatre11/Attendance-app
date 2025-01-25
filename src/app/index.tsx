import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import Login from './components/Login';
import { UserProvider } from './context/UserContext';
import { createStackNavigator } from '@react-navigation/stack';
import StudentView from './components/StudentView';
import TeacherView from './components/TeacherView';
import { UUIDProvider } from './context/uuidContext';
import { NavigationContainer } from '@react-navigation/native';

const Stack = createStackNavigator();

const App = () => {
  return (
      <UUIDProvider>
        <UserProvider>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="StudentView" component={StudentView} />
            <Stack.Screen name="TeacherView" component={TeacherView} />
          </Stack.Navigator>
        </UserProvider>
      </UUIDProvider>
  );
};

export default App;

const styles = StyleSheet.create({});