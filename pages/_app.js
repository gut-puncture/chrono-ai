// pages/_app.js
import * as React from 'react';
import PropTypes from 'prop-types';
import Head from 'next/head';
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SWRConfig } from 'swr'; // Import SWRConfig

const theme = createTheme({
  palette: {
    mode: 'light'
    // Add additional theme customization here if needed
  },
});

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
          fetcher: (url) => fetch(url).then(r => r.json()) // Customize the fetcher as needed
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
