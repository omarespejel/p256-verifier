import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { holesky, mainnet, sepolia } from 'wagmi/chains'
import App from './App'
import './style.css'

const rpcDefaults = {
  [mainnet.id]: import.meta.env.VITE_RPC_MAINNET ?? 'https://eth.llamarpc.com',
  [sepolia.id]: import.meta.env.VITE_RPC_SEPOLIA ?? 'https://rpc.sepolia.org',
  [holesky.id]:
    import.meta.env.VITE_RPC_HOLESKY ?? 'https://ethereum-holesky.publicnode.com'
}

const config = createConfig({
  chains: [mainnet, sepolia, holesky],
  transports: {
    [mainnet.id]: http(rpcDefaults[mainnet.id]),
    [sepolia.id]: http(rpcDefaults[sepolia.id]),
    [holesky.id]: http(rpcDefaults[holesky.id])
  }
})

const queryClient = new QueryClient()
const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Root element #app not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
)

