import { typography, spacing } from '@/constants/theme';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, TextInput } from 'react-native';

export function useKeyboardAwareForm<Field extends string>() {
  const scrollRef = useRef<ScrollView>(null);
  const inputsRef = useRef(new Map<Field, TextInput>());
  const refCallbacks = useRef(new Map<Field, (input: TextInput | null) => void>());
  const focusCallbacks = useRef(new Map<Field, () => void>());
  const activeFieldRef = useRef<Field | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef(Number.POSITIVE_INFINITY);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const revealField = useCallback((field = activeFieldRef.current) => {
    if (!field) return;
    const input = inputsRef.current.get(field); const scroller = scrollRef.current;
    if (!input || !scroller) return;
    requestAnimationFrame(() => {
      const nativeScroller = scroller.getNativeScrollRef();
      if (!nativeScroller) return;
      nativeScroller.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
        input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
          const labelHeight = typography.bodySmall + spacing.md;
          const visibleTop = scrollY + spacing.md;
          const visibleBottom = Math.min(scrollY + scrollHeight, keyboardTopRef.current) - spacing.xl;
          const fieldTop = inputY - labelHeight; const fieldBottom = inputY + inputHeight;
          const delta = fieldBottom > visibleBottom ? fieldBottom - visibleBottom : fieldTop < visibleTop ? fieldTop - visibleTop : 0;
          if (Math.abs(delta) > 1) scroller.scrollTo({ y: Math.max(0, scrollOffsetRef.current + delta), animated: true });
        });
      });
    });
  }, []);
  const scheduleReveal = useCallback((field = activeFieldRef.current) => requestAnimationFrame(() => requestAnimationFrame(() => revealField(field))), [revealField]);

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => { keyboardTopRef.current = event.endCoordinates.screenY; if (Platform.OS === 'android') setKeyboardHeight(event.endCoordinates.height); scheduleReveal(); };
    const onHide = () => { keyboardTopRef.current = Number.POSITIVE_INFINITY; setKeyboardHeight(0); };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { show.remove(); hide.remove(); };
  }, [scheduleReveal]);

  const fieldProps = useCallback((field: Field) => {
    if (!refCallbacks.current.has(field)) refCallbacks.current.set(field, (input) => { if (input) inputsRef.current.set(field, input); else inputsRef.current.delete(field); });
    if (!focusCallbacks.current.has(field)) focusCallbacks.current.set(field, () => { activeFieldRef.current = field; scheduleReveal(field); });
    return { ref: refCallbacks.current.get(field)!, onFocus: focusCallbacks.current.get(field)! };
  }, [scheduleReveal]);
  const focusField = useCallback((field: Field) => requestAnimationFrame(() => inputsRef.current.get(field)?.focus()), []);
  const trackScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }, []);

  return {
    fieldProps,
    focusField,
    screenProps: { keyboardAware: true as const, scrollRef, scrollBottomInset: keyboardHeight, onScrollViewLayout: () => scheduleReveal(), onScrollViewScroll: trackScroll },
  };
}
