import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { queryClient } from './app/queryClient';
import { AuthProvider } from './auth/AuthProvider';

const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: '700',
  },
  colors: {
    watchtrace: [
      '#effbf8',
      '#d9f4ee',
      '#b4e8dc',
      '#8bdac8',
      '#69cfb7',
      '#55c8ad',
      '#48c4a7',
      '#38ac91',
      '#2a997f',
      '#11856c',
    ],
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
