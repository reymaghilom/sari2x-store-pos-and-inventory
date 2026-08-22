const { AndroidConfig, withAndroidColors, withAndroidColorsNight } = require('@expo/config-plugins');

const light = {
  sari_background: '#F7F9FC', sari_surface: '#FFFFFF', sari_surface_muted: '#F1F4F8', sari_text: '#111827', sari_text_muted: '#64748B', sari_border: '#E2E8F0',
  sari_primary: '#2146D0', sari_primary_dark: '#1737AF', sari_primary_soft: '#EEF3FF', sari_primary_border: '#D5E0FF',
  sari_success: '#15803D', sari_success_soft: '#EAF8EE', sari_success_border: '#CDE8D5', sari_danger: '#DC2626', sari_danger_soft: '#FEF0F0', sari_danger_border: '#F4D0D0',
  sari_warning: '#D97706', sari_warning_soft: '#FFF7E6', sari_warning_border: '#F1DFBA', sari_info: '#0284C7', sari_info_soft: '#EAF6FC', sari_info_border: '#C5E5F4',
};
const dark = {
  sari_background: '#111827', sari_surface: '#1F2937', sari_surface_muted: '#273449', sari_text: '#F8FAFC', sari_text_muted: '#CBD5E1', sari_border: '#3A475B',
  sari_primary: '#5B7CFA', sari_primary_dark: '#7893FF', sari_primary_soft: '#1E2D5A', sari_primary_border: '#3B518F',
  sari_success: '#4ADE80', sari_success_soft: '#173A2A', sari_success_border: '#25613D', sari_danger: '#F87171', sari_danger_soft: '#472126', sari_danger_border: '#7F3038',
  sari_warning: '#FBBF24', sari_warning_soft: '#493516', sari_warning_border: '#76551D', sari_info: '#38BDF8', sari_info_soft: '#173447', sari_info_border: '#285E78',
};

function assignPalette(xml, palette) {
  return Object.entries(palette).reduce((result, [name, value]) => AndroidConfig.Colors.assignColorValue(result, { name, value }), xml);
}

module.exports = function withAppTheme(config) {
  config = withAndroidColors(config, (mod) => { mod.modResults = assignPalette(mod.modResults, light); return mod; });
  return withAndroidColorsNight(config, (mod) => { mod.modResults = assignPalette(mod.modResults, dark); return mod; });
};
