import { Tabs, router } from 'expo-router';
import { theme } from '../../theme/theme';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// We will use standard translucent hex for the tab bar since we can't add expo-blur without being sure it's installed.
// Wait, is expo-blur installed? I'll check. If not, fallback to rgba.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: theme.colors.textPrimary,
        headerTransparent: true,
        headerTitleStyle: {
          fontSize: theme.typography.sizes.xl,
          fontWeight: theme.typography.weights.bold,
        },
        tabBarStyle: {
          backgroundColor: 'rgba(22, 25, 31, 0.85)',
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 65 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 25 : insets.bottom + 8,
          paddingTop: 8,
          position: 'absolute', // Important for glass effect over content
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-placeholder"
        options={{
          title: '',
          tabBarButton: (props) => (
            <View style={styles.addButtonContainer}>
              <View style={styles.addButtonGlow} />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/add')}
                accessibilityLabel="Add attendance"
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="upcoming"
        options={{
          title: 'Upcoming',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addButtonContainer: {
    top: -24,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    height: 64,
  },
  addButtonGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    opacity: 0.3,
    transform: [{ scale: 1.2 }],
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
