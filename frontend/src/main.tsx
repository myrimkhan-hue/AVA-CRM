import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './i18n';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { darkAntdTheme, lightAntdTheme } from './theme/antdTheme';
import { ThemeProvider, useThemeMode } from './theme/ThemeContext';
import './theme/tokens.css';
import './styles.css';

function ThemedApp() {
  const { mode } = useThemeMode();

  return (
    <ConfigProvider
      locale={ruRU}
      theme={mode === 'dark' ? darkAntdTheme : lightAntdTheme}
    >
      <AntdApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </React.StrictMode>,
);
