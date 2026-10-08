import { Stack } from 'expo-router';
import { theme } from '../theme/theme';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.textPrimary,
          contentStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="add" 
          options={{ 
            presentation: 'modal', 
            title: 'Add Attendance' 
          }} 
        />
        <Stack.Screen 
          name="add-timetable" 
          options={{ 
            presentation: 'modal', 
            title: 'Timetable Entry' 
          }} 
        />
        <Stack.Screen 
          name="subject/[id]" 
          options={{ 
            title: 'Subject Detail' 
          }} 
        />
      </Stack>
    </>
  );
}
