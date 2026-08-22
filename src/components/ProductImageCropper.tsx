import { createThemedStyles } from '@/store/appearance';
import { clampCropTransform, coverSize, CropTransform, MAX_CROP_ZOOM, MIN_CROP_ZOOM, translationBounds } from '@/utils/imageCrop';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  uri: string;
  sourceWidth: number;
  sourceHeight: number;
  frameSize: number;
  resetSignal: number;
  onTransformChange: (transform: CropTransform) => void;
};

const INITIAL_TRANSFORM: CropTransform = { translateX: 0, translateY: 0, zoom: 1 };

export function ProductImageCropper({ uri, sourceWidth, sourceHeight, frameSize, resetSignal, onTransformChange }: Props) {
  const styles = useStyles();
  const covered = useMemo(() => coverSize(sourceWidth, sourceHeight, frameSize), [frameSize, sourceHeight, sourceWidth]);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const gestureStartX = useSharedValue(0);
  const gestureStartY = useSharedValue(0);
  const gestureStartZoom = useSharedValue(1);

  const reportTransform = useCallback((x: number, y: number, scale: number) => {
    onTransformChange(clampCropTransform({ translateX: x, translateY: y, zoom: scale }, sourceWidth, sourceHeight, frameSize));
  }, [frameSize, onTransformChange, sourceHeight, sourceWidth]);

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    zoom.value = 1;
    onTransformChange(INITIAL_TRANSFORM);
  }, [onTransformChange, resetSignal, translateX, translateY, uri, zoom]);

  const gestures = useMemo(() => {
    const clampX = (value: number, scale: number) => {
      'worklet';
      const bound = Math.max(0, (covered.width * scale - frameSize) / 2);
      return Math.min(bound, Math.max(-bound, value));
    };
    const clampY = (value: number, scale: number) => {
      'worklet';
      const bound = Math.max(0, (covered.height * scale - frameSize) / 2);
      return Math.min(bound, Math.max(-bound, value));
    };

    const pan = Gesture.Pan()
      .enabled(true)
      .minPointers(1)
      .maxPointers(1)
      .minDistance(1)
      .shouldCancelWhenOutside(false)
      .onBegin(() => {
        gestureStartX.value = translateX.value;
        gestureStartY.value = translateY.value;
      })
      .onUpdate((event) => {
        translateX.value = clampX(gestureStartX.value + event.translationX, zoom.value);
        translateY.value = clampY(gestureStartY.value + event.translationY, zoom.value);
      })
      .onFinalize(() => {
        const x = clampX(translateX.value, zoom.value);
        const y = clampY(translateY.value, zoom.value);
        translateX.value = withTiming(x, { duration: 120 });
        translateY.value = withTiming(y, { duration: 120 });
        runOnJS(reportTransform)(x, y, zoom.value);
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        gestureStartZoom.value = zoom.value;
      })
      .onUpdate((event) => {
        const nextZoom = Math.min(MAX_CROP_ZOOM, Math.max(MIN_CROP_ZOOM, gestureStartZoom.value * event.scale));
        zoom.value = nextZoom;
        translateX.value = clampX(translateX.value, nextZoom);
        translateY.value = clampY(translateY.value, nextZoom);
      })
      .onFinalize(() => {
        const nextZoom = Math.min(MAX_CROP_ZOOM, Math.max(MIN_CROP_ZOOM, zoom.value));
        const x = clampX(translateX.value, nextZoom);
        const y = clampY(translateY.value, nextZoom);
        zoom.value = withTiming(nextZoom, { duration: 120 });
        translateX.value = withTiming(x, { duration: 120 });
        translateY.value = withTiming(y, { duration: 120 });
        runOnJS(reportTransform)(x, y, nextZoom);
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [covered.height, covered.width, frameSize, gestureStartX, gestureStartY, gestureStartZoom, reportTransform, translateX, translateY, zoom]);

  const translationStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const bounds = translationBounds(sourceWidth, sourceHeight, frameSize, 1);

  return (
    <View accessibilityLabel="Square photo crop area" style={[styles.frame, { width: frameSize, height: frameSize }]}>
      <GestureDetector gesture={gestures}>
        <View style={styles.gestureSurface}>
          <Animated.View style={[styles.imagePosition, { width: covered.width, height: covered.height, left: -bounds.x, top: -bounds.y }, translationStyle]}>
            <Animated.View style={[styles.imageFill, zoomStyle]}>
              <Image source={{ uri }} style={styles.imageFill} contentFit="fill" transition={100} />
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>
      <View pointerEvents="none" style={styles.cropFrame}>
        <View style={[styles.gridVertical, { left: '33.333%' }]} />
        <View style={[styles.gridVertical, { left: '66.666%' }]} />
        <View style={[styles.gridHorizontal, { top: '33.333%' }]} />
        <View style={[styles.gridHorizontal, { top: '66.666%' }]} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  frame: { position: 'relative', overflow: 'hidden', backgroundColor: colors.text },
  gestureSurface: { flex: 1 },
  imagePosition: { position: 'absolute' },
  imageFill: { width: '100%', height: '100%' },
  cropFrame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: colors.white },
  gridVertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.42)' },
  gridHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.42)' },
}));
