import { useEffect, useState } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';

/**
 * How much of the screen the keyboard covers, accessory bar included.
 *
 * `KeyboardAvoidingView` leaves the form's action row under the keyboard inside
 * a native modal, so the row positions itself from the raw frame instead.
 */
export function useKeyboardOverlap(): number {
  const { height: screenHeight } = useWindowDimensions();
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      setOverlap(Math.max(screenHeight - event.endCoordinates.screenY, 0));
    });
    return () => subscription.remove();
  }, [screenHeight]);

  return overlap;
}
