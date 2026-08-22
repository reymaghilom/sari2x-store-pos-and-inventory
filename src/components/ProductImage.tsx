import { createThemedStyles } from '@/store/appearance';
import { radius } from '@/constants/theme';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

export function ProductImage({ uri, fallback = '📦', size = 52, style }: { uri?: string | null; fallback?: string; size?: number; style?: StyleProp<ViewStyle> }) {  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  return <View style={[styles.frame, { width: size, height: size, borderRadius: Math.min(radius.md, size / 4) }, style]}>
    {uri && !failed
      ? <Image source={{ uri }} style={styles.image} contentFit="cover" transition={120} onError={() => setFailed(true)} />
      : <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.fallback, { fontSize: size * 0.52 }]}>{fallback}</Text>}
  </View>;
}

const useStyles = createThemedStyles((colors) => ({ frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, image: { width: '100%', height: '100%' }, fallback: { textAlign: 'center' } }));
