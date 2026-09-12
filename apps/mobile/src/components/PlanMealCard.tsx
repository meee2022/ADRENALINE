import { translate as localize, contentLanguage as uiLanguage, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SelectionMeal } from '@/subscriberSelection';
import { scaledNutrition, customerCategoryLabel } from '@/rules';
import { menuArtwork } from '@/menuArtwork';
import { colors } from '@/theme';
import { T } from './ui';

/** Compact result card: image, readable name, nutrition and action in one surface. */
export function PlanMealCard({meal,factor,width,label,disabled,onPress}:{
  meal:SelectionMeal;factor:number;width:number;label:string;disabled:boolean;onPress:()=>void;
}){
  useUILanguage();
  const nutrition=scaledNutrition(meal,factor);
  const source=menuArtwork[meal._id];
  return <View style={[s.card,{width}]}>
    <View style={s.photo}>{source?<Image source={source} accessibilityLabel={localize(String(localizedField(meal)))} contentFit="cover" style={StyleSheet.absoluteFill}/>:<View style={s.empty}><Ionicons name="restaurant-outline" size={24} color={colors.muted2}/><T style={s.category}>الصورة قريبًا</T></View>}</View>
    <View style={s.body}>
      <T style={s.category}>{customerCategoryLabel(meal.category,uiLanguage() === 'ar')}</T>
      <T w="bold" style={s.name}>{localizedField(meal, 'name')}</T>
      <View style={s.energy}><Ionicons name="flame-outline" size={14} color={colors.cyanDark}/><T w="bold" style={s.calories}>{nutrition.calories??'—'} سعرة</T></View>
      <Pressable accessibilityRole="button" accessibilityLabel={localize(label)+' '+localizedField(meal)} disabled={disabled} onPress={onPress} style={({pressed})=>[s.action,disabled&&{opacity:.45},pressed&&{backgroundColor:colors.line}]}>
        <Ionicons name={label==='تبديل'?'swap-horizontal-outline':'checkmark-outline'} size={16} color={colors.cyanDark}/><T w="bold" style={s.actionText}>{label}</T>
      </Pressable>
    </View>
  </View>;
}
const s=StyleSheet.create({
  card:{borderRadius:12,overflow:'hidden',backgroundColor:colors.card,borderWidth:1,borderColor:colors.line},
  photo:{aspectRatio:1.65,backgroundColor:colors.bg2},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:4},
  body:{padding:10,gap:5},category:{fontSize:11,color:colors.muted2},name:{fontSize:13,lineHeight:21,minHeight:42,color:colors.navy2},
  energy:{flexDirection:'row',gap:4,alignItems:'center'},calories:{fontSize:12,color:colors.cyanDark},
  action:{marginTop:5,minHeight:44,backgroundColor:colors.cyanSoft,borderRadius:8,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},
  actionText:{fontSize:12,color:colors.cyanDark},
});
