import { Pressable, Animated, PressableProps, ViewStyle, StyleProp } from 'react-native';
import { useRef, useCallback } from 'react';

interface AnimatedPressableProps extends PressableProps {
  scaleValue?: number;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({
  onPress,
  style,
  children,
  disabled,
  scaleValue = 0.97,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, scaleValue]);

  const animateOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  // The Pressable is a transparent hit-area wrapper with no layout styles.
  // All layout/visual styles (padding, borderRadius, backgroundColor, etc.)
  // live on the Animated.View so the content has real dimensions and the
  // press target is never zero-height.
  return (
    <Pressable
      onPressIn={animateIn}
      onPressOut={animateOut}
      onPress={onPress}
      disabled={disabled}
      {...props}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale }] },
          disabled && { opacity: 0.5 },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
