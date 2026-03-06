import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

type ToastContextValue = {
  show: (message: string, options?: { durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (nextMessage: string, options?: { durationMs?: number }) => {
      const durationMs = options?.durationMs ?? 2200;

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }

      setMessage(nextMessage);
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(0);
      translateY.setValue(12);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 12, duration: 180, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished) setMessage(null);
        });
      }, durationMs);
    },
    [opacity, translateY],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View pointerEvents="none" style={styles.host}>
          <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
            <Text style={styles.toastText}>{message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    maxWidth: Math.min(width - 32, 520),
    backgroundColor: 'rgba(17, 17, 17, 0.92)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
