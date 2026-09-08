import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

const fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";

export const lightAntdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    fontFamily,
    fontSize: 14,
    colorPrimary: '#E4140E',
    colorPrimaryHover: '#C10F0A',
    borderRadius: 14,
    borderRadiusLG: 20,
    borderRadiusSM: 11,
    colorBgLayout: '#EEF1F6',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorText: '#151A21',
    colorTextSecondary: '#4B5462',
    colorTextTertiary: '#6C7482',
    colorTextQuaternary: '#8B93A1',
    colorBorder: '#E7EBF1',
    colorBorderSecondary: '#F0F2F6',
    colorError: '#C1120C',
    colorSuccess: '#0E7A4E',
    colorWarning: '#A8620A',
    colorInfo: '#1550B8',
  },
  components: {
    Button: {
      controlHeight: 38,
      fontWeight: 600,
      primaryShadow: 'none',
      defaultBg: '#F3F5F9',
      defaultHoverBg: '#E9EDF4',
      defaultBorderColor: '#E7EBF1',
    },
    // Рамку полей ввода берём от --faint, а не от общей линии --line: фон поля
    // и фон карточки различаются всего в 1,09 раза, и без внятной рамки поле не
    // читается как поле — непонятно, куда нажимать и где оно заканчивается.
    Input: {
      colorBgContainer: '#F3F5F9',
      hoverBg: '#F3F5F9',
      activeBg: '#F3F5F9',
      colorBorder: '#D3D9E3',
      borderRadius: 14,
    },
    Select: {
      selectorBg: '#F3F5F9',
      colorBorder: '#D3D9E3',
      borderRadius: 14,
      optionSelectedBg: '#E9EDF4',
    },
    DatePicker: {
      colorBgContainer: '#F3F5F9',
      hoverBg: '#F3F5F9',
      activeBg: '#F3F5F9',
      colorBorder: '#D3D9E3',
      borderRadius: 14,
    },
    InputNumber: {
      colorBgContainer: '#F3F5F9',
      colorBorder: '#D3D9E3',
      borderRadius: 14,
    },
    Card: {
      colorBgContainer: '#FFFFFF',
      borderRadiusLG: 22,
      headerBg: '#FFFFFF',
    },
    Table: {
      headerBg: 'transparent',
      headerColor: '#8B93A1',
      rowHoverBg: '#FAFBFD',
      borderColor: '#F0F2F6',
    },
    Layout: {
      bodyBg: '#EEF1F6',
      headerBg: '#FFFFFF',
      siderBg: '#FFFFFF',
    },
    Modal: {
      headerBg: '#FFFFFF',
      contentBg: '#FFFFFF',
      footerBg: '#FFFFFF',
      titleColor: '#151A21',
      borderRadiusLG: 22,
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
      colorBgContainer: '#FFFFFF',
    },
    Tag: {
      defaultBg: '#F3F5F9',
      defaultColor: '#4B5462',
      borderRadiusSM: 10,
    },
  },
} satisfies ThemeConfig;

export const darkAntdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    fontFamily,
    fontSize: 14,
    colorPrimary: '#E4140E',
    colorPrimaryHover: '#C10F0A',
    borderRadius: 14,
    borderRadiusLG: 20,
    borderRadiusSM: 11,
    colorBgLayout: '#0B0D10',
    colorBgContainer: '#14181E',
    colorBgElevated: '#14181E',
    colorText: '#E8EBEF',
    colorTextSecondary: '#C3CAD3',
    colorTextTertiary: '#9AA5B2',
    colorTextQuaternary: '#7C8794',
    colorBorder: '#262E38',
    colorBorderSecondary: '#1F262E',
    colorError: '#FF8681',
    colorSuccess: '#4ADE80',
    colorWarning: '#FBBF4A',
    colorInfo: '#7FB0FF',
  },
  components: {
    Button: {
      controlHeight: 38,
      fontWeight: 600,
      primaryShadow: 'none',
      defaultBg: '#1C222A',
      defaultHoverBg: '#232A33',
      defaultBorderColor: '#262E38',
    },
    // См. пояснение в светлой теме: рамка поля берётся от --faint.
    Input: {
      colorBgContainer: '#1C222A',
      hoverBg: '#1C222A',
      activeBg: '#1C222A',
      colorBorder: '#39424D',
      borderRadius: 14,
    },
    Select: {
      selectorBg: '#1C222A',
      colorBorder: '#39424D',
      borderRadius: 14,
      optionSelectedBg: '#232A33',
    },
    DatePicker: {
      colorBgContainer: '#1C222A',
      hoverBg: '#1C222A',
      activeBg: '#1C222A',
      colorBorder: '#39424D',
      borderRadius: 14,
    },
    InputNumber: {
      colorBgContainer: '#1C222A',
      colorBorder: '#39424D',
      borderRadius: 14,
    },
    Card: {
      colorBgContainer: '#14181E',
      borderRadiusLG: 22,
      headerBg: '#14181E',
    },
    Table: {
      headerBg: 'transparent',
      headerColor: '#7C8794',
      rowHoverBg: '#191E25',
      borderColor: '#1F262E',
    },
    Layout: {
      bodyBg: '#0B0D10',
      headerBg: '#14181E',
      siderBg: '#14181E',
    },
    Modal: {
      headerBg: '#14181E',
      contentBg: '#14181E',
      footerBg: '#14181E',
      titleColor: '#E8EBEF',
      borderRadiusLG: 22,
    },
    Drawer: {
      colorBgElevated: '#14181E',
      colorBgContainer: '#14181E',
    },
    Tag: {
      defaultBg: '#1C222A',
      defaultColor: '#C3CAD3',
      borderRadiusSM: 10,
    },
  },
} satisfies ThemeConfig;
