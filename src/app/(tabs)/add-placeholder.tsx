/**
 * This screen is never actually rendered.
 *
 * The `add-placeholder` tab slot exists purely so that the (tabs) layout
 * can place the floating "+" action button in the center of the tab bar
 * via a custom `tabBarButton`. When the user taps "+", the router
 * navigates to `/add` (a modal), not to this screen.
 *
 * Expo Router requires every Tabs.Screen name to have a matching file,
 * so this stub satisfies that file-system requirement.
 */
import { View } from 'react-native';

export default function AddPlaceholder() {
  return <View />;
}
