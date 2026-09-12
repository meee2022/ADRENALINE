import React, { forwardRef } from 'react';
import { TextInput as NativeTextInput, TextInputProps, StyleSheet } from 'react-native';
import { useContentLanguage } from '@/useContentLanguage';

/** Input values are never translated. Only labels, placeholders and presentation change. */
export const TextInput = forwardRef<NativeTextInput, TextInputProps>((props, ref) => {
  const { language, tr } = useContentLanguage();
  const style = StyleSheet.flatten(props.style);
  const fixedLTR = props.secureTextEntry || ['email-address', 'url', 'phone-pad', 'decimal-pad', 'number-pad', 'numeric'].includes(props.keyboardType || '') || props.autoComplete === 'current-password';
  return <NativeTextInput {...props} ref={ref}
    placeholder={props.placeholder ? tr(props.placeholder) : undefined}
    accessibilityLabel={props.accessibilityLabel ? tr(props.accessibilityLabel) : undefined}
    style={[props.style, { fontSize: Math.max(16, style?.fontSize || 16),
      writingDirection: fixedLTR || language === 'en' ? 'ltr' : 'rtl',
      textAlign: style?.textAlign === 'center' ? 'center' : fixedLTR || language === 'en' ? 'left' : 'right',
    }]} />;
});
