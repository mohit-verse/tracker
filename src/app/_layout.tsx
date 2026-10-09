import { Stack } from 'expo-router';
import { theme } from '../theme/theme';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { BackgroundGlow } from '../components/BackgroundGlow';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <BackgroundGlow />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTintColor: theme.colors.textPrimary,
          contentStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTransparent: true, // Make header truly transparent over the background
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="add" 
          options={{ 
            presentation: 'modal',
            headerShown: false, // Custom header inside the modal
          }} 
        />
        <Stack.Screen 
          name="add-timetable" 
          options={{ 
            presentation: 'modal',
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="subject/[id]" 
          options={{ 
            headerShown: false,
          }} 
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  }
});
