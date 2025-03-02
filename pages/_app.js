// pages/_app.js
import * as React from 'react';
import PropTypes from 'prop-types';
import Head from 'next/head';
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import dynamic from 'next/dynamic'; // Import dynamic

const theme = createTheme({
  palette: {
    mode: 'light'
    // Add additional theme customization here if needed
  },
});

const SWRConfig = dynamic(
  () => import('swr').then((mod) => mod.SWRConfig),
  { ssr: false }
);

export default function MyApp({ Component, pageProps: { session,...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Head>
        <title>Unified Workspace MVP</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SWRConfig value={{
          fetcher: (url) => fetch(url).then(r => r.json()),
          revalidateOnFocus: false, // Disable revalidation on window focus
          revalidateOnReconnect: false, // Disable revalidation on network reconnect
          refreshInterval: 0 // Disable automatic polling
        }}>
          <Component {...pageProps} />
        </SWRConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
};
