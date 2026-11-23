// Metropolis (public domain, see public/licenses/metropolis-UNLICENSE.txt): latin subset, the five
// weights the typography tokens use. Each @font-face has font-display: swap.
import '@fontsource/metropolis/latin-400.css';
import '@fontsource/metropolis/latin-500.css';
import '@fontsource/metropolis/latin-600.css';
import '@fontsource/metropolis/latin-700.css';
import '@fontsource/metropolis/latin-800.css';
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { queryClient } from '@/lib/queryClient';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing in index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
