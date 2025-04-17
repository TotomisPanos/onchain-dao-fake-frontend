'use client'

import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider, Contract, formatEther, getAddress } from 'ethers'
import Head from 'next/head'
import { Inter } from 'next/font/google'
import {
  CryptoDevsDAOABI,
  CryptoDevsDAOAddress,
  CryptoDevsNFTABI,
  CryptoDevsNFTAddress,
  FakeNFTMarketplaceAddress
} from '../constants/ContractInfo'
import { CheckCircle, Cpu, Globe } from 'lucide-react';   // ⇦ icons

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function Home() {
  /* ───────────────────────── connection & chain state ──────────────────────── */
  const [provider, setProvider]   = useState(null)
  const [signer, setSigner]       = useState(null)
  const [address, setAddress]     = useState('')
  const [mounted, setMounted]     = useState(false)

  const [loading, setLoading]           = useState(false)
  const [fakeId, setFakeId]             = useState('')
  const [tab, setTab]                   = useState('')

  const [proposals, setProposals]       = useState([])
  const [daoOwner, setDaoOwner]         = useState('')
  const [daoBalance, setDaoBalance]     = useState(0n)
  const [numProposals, setNumProposals] = useState(0)
  const [nftBalance, setNftBalance]     = useState(0)

  /* ───────────────────────── helpers ──────────────────────── */
  const daoRead  = useCallback(() => new Contract(CryptoDevsDAOAddress, CryptoDevsDAOABI, provider) , [provider])
  const daoWrite = useCallback(() => new Contract(CryptoDevsDAOAddress, CryptoDevsDAOABI, signer)  , [signer])
  const nftRead  = useCallback(() => new Contract(CryptoDevsNFTAddress,  CryptoDevsNFTABI,  provider), [provider])

  const connect = useCallback(async () => {
    if (!window.ethereum) { window.alert('MetaMask not detected'); return }
    const prov = new BrowserProvider(window.ethereum)
    await prov.send('eth_requestAccounts', [])
    const sig = await prov.getSigner()

    setProvider(prov)
    setSigner(sig)
    setAddress(getAddress(await sig.getAddress()))

    window.ethereum.on('accountsChanged', async acc => {
      if (acc.length) {
        setAddress(getAddress(acc[0]))
        setSigner(await prov.getSigner())
      } else {
        setAddress('')
        setSigner(null)
      }
    })
  }, [])

  const refresh = useCallback(async () => {
    if (!provider) return
    const dao = daoRead()
    setNumProposals(Number(await dao.numProposals()))
    setDaoOwner(await dao.owner())
    setDaoBalance(await provider.getBalance(CryptoDevsDAOAddress))
    if (address) setNftBalance(Number(await nftRead().balanceOf(address)))
  }, [provider, address, daoRead, nftRead])

  const fetchProposal = async id => {
    const p = await daoRead().proposals(id)
    const [nftTokenId, deadline, yay, nay, executed] = p
    return {
      id,
      nftTokenId: nftTokenId.toString(),
      deadline:   new Date(Number(deadline) * 1e3),
      yay:        yay.toString(),
      nay:        nay.toString(),
      executed
    }
  }

  const loadProposals = async () => {
    const list = []
    for (let i = 0; i < numProposals; i++) list.push(await fetchProposal(i))
    setProposals(list)
  }

  const wrapTx = async fn => {
    setLoading(true)
    try {
      const tx = await fn()
      await tx.wait()
      await refresh()
      if (tab === 'View') await loadProposals()
    } catch (e) { console.error(e); window.alert(e) }
    setLoading(false)
  }

  const create       = ()              => wrapTx(() => daoWrite().createProposal(fakeId))
  const vote         = (id, yay)       => wrapTx(() => daoWrite().voteOnProposal(id, yay ? 0 : 1))
  const execute      = id              => wrapTx(() => daoWrite().executeProposal(id))
  const withdrawEth  = ()              => wrapTx(() => daoWrite().withdrawEther())

  /* ───────────────────────── effects ──────────────────────── */
  useEffect(() => { connect() }, [])
  useEffect(() => { refresh() }, [provider, address])
  useEffect(() => { if (tab === 'View') loadProposals() }, [tab])
  useEffect(() => { setMounted(true) }, [])

  /* ───────────────────────── render helpers ──────────────────────── */
  const Btn = ({ children, onClick, disabled, variant = 'primary', className='' }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 font-medium transition
        ${variant === 'primary'
          ? 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50'
          : 'bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50'}
        ${className}`}
    >
      {children}
    </button>
  )

  const CreateTab = () => {
    if (loading) return <p className="mt-4 text-gray-300">Loading…</p>
    if (nftBalance === 0)
      return <p className="mt-4 text-sm text-red-400">You own no CryptoDevs NFTs – creating or voting is disabled.</p>

    return (
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-medium">Fake NFT Token ID</label>
        <input
          type="number"
          placeholder="0"
          onChange={e => setFakeId(e.target.value)}
          className="w-24 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-white"
        />
        <Btn className='mx-2' onClick={create}>Create</Btn>
      </div>
    )
  }

  const ViewTab = () => {
    if (loading) return <p className="mt-4 text-gray-300">Loading…</p>
    if (!proposals.length) return <p className="mt-4 text-gray-400">No proposals yet.</p>

    return proposals.map(p => (
      <div key={p.id} className="my-6 rounded-xl bg-gray-800 p-5 shadow">
        <p className="font-semibold">Proposal #{p.id}</p>
        <p>Fake NFT ID: {p.nftTokenId}</p>
        <p>Deadline: {p.deadline.toLocaleString()}</p>
        <p>Yay / Nay: {p.yay} / {p.nay}</p>
        <p>Executed: {p.executed.toString()}</p>

        {!p.executed && p.deadline > Date.now() && (
          <div className="mt-3 flex gap-3">
            <Btn variant="secondary" onClick={() => vote(p.id, true)}>Vote YAY</Btn>
            <Btn variant="secondary" onClick={() => vote(p.id, false)}>Vote NAY</Btn>
          </div>
        )}

        {!p.executed && p.deadline < Date.now() && (
          <div className="mt-3">
            <Btn variant="secondary" onClick={() => execute(p.id)}>
              Execute {p.yay > p.nay ? '(YAY)' : '(NAY)'}
            </Btn>
          </div>
        )}

        {p.executed && <p className="mt-2 text-sm text-green-500">Executed</p>}
      </div>
    ))
  }

  /* ───────────────────────── component ──────────────────────── */
  if (!mounted) return null
  if (!address)
    return (
      <div className={`${inter.className} flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4 text-white`}>
        <Btn onClick={connect}>Connect Wallet</Btn>
      </div>
    )

  return (
    <div className={`${inter.className} min-h-screen bg-gradient-to-b from-gray-900 to-black text-white`}>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto flex flex-col gap-12 px-4 py-12 lg:flex-row lg:items-start">
        {/* ───────── left column ───────── */}
        <div className="flex-1">
          <h1 className="text-4xl font-bold tracking-tight">Welcome to Crypto Devs DAO</h1>
          <p className="mt-2 text-gray-300">Govern your community treasury in real time.</p>
          <AboutSection />

        <div className="mt-8 flex flex-col items-center gap-4 rounded-xl bg-gray-800/70 p-6 shadow-lg backdrop-blur">

          {/* chain stats */}
          <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-gray-200 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-800/70 p-4 shadow">
              <p className="text-gray-400">Your NFTs</p>
              <p className="mt-1 text-lg font-semibold text-white">{nftBalance}</p>
            </div>
            <div className="rounded-lg bg-gray-800/70 p-4 shadow">
              <p className="text-gray-400">Treasury</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatEther(daoBalance)} ETH</p>
            </div>
            <div className="rounded-lg bg-gray-800/70 p-4 shadow">
              <p className="text-gray-400">Total Proposals</p>
              <p className="mt-1 text-lg font-semibold text-white">{numProposals}</p>
            </div>
          </div>

          {/* nav buttons */}
          <div className="mt-6 flex gap-4">
            <Btn variant={tab === 'Create' ? 'primary' : 'secondary'} onClick={() => setTab('Create')}>Create Proposal</Btn>
            <Btn variant={tab === 'View'   ? 'primary' : 'secondary'} onClick={() => setTab('View')}>View Proposals</Btn>
          </div>

          {/* dynamic tab panels */}
          {tab === 'Create' && <CreateTab />}
          {tab === 'View'   && <ViewTab />}

          {/* owner‑only withdraw */}
          {address.toLowerCase() === daoOwner.toLowerCase() && (
            <div className="mt-8">
              <Btn onClick={withdrawEth} disabled={loading}>
                {loading ? 'Loading…' : 'Withdraw DAO ETH'}
              </Btn>
            </div>
          )}

          </div>

          {/* ───────── Etherscan links ───────── */}
          <div className="mt-12">
            <h2 className="mb-2 text-lg font-semibold">Contracts on Etherscan</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-indigo-300">
              <li>
                <a
                  href={`https://sepolia.etherscan.io/address/${CryptoDevsNFTAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  CryptoDevsNFT
                </a>
              </li>
              <li>
                <a
                  href={`https://sepolia.etherscan.io/address/${FakeNFTMarketplaceAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  FakeNFTMarketplace
                </a>
              </li>
              <li>
                <a
                  href={`https://sepolia.etherscan.io/address/${CryptoDevsDAOAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  CryptoDevsDAO
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function AboutSection() {
  const card = (Icon, title, children) => (
    <div className="flex flex-col gap-2 rounded-xl bg-gray-800/70 p-5 shadow-lg backdrop-blur">
      <Icon className="h-6 w-6 text-indigo-400" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-300">{children}</p>
    </div>
  );

  return (
    <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {card(CheckCircle,
        'On‑chain Governance',
        'Every proposal, vote, and execution lives in a single smart contract—fully transparent and tamper‑proof.'
      )}
      {card(Cpu,
        'Self‑Financed Treasury',
        'The DAO deployer seeded the contract with ETH. ETH out only happens through a passed proposal or owner withdrawal.'
      )}
      {card(Globe,
        'Frontend in Next.js + Tailwind',
        'The dashboard talks to the chain with ethers v6, no servers or databases in between.'
      )}
      <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-indigo-600/30 p-6">
        <h3 className="mb-1 text-lg font-semibold text-indigo-300">How it works</h3>
        <ul className="list-disc space-y-1 pl-6 text-sm text-gray-300">
          <li>Hold a <b>CryptoDevs NFT</b> → 1 token = 1 vote.</li>
          <li>Create a proposal to buy a target NFT from the on‑chain fake marketplace.</li>
          <li>Vote <b>Yay</b> or <b>Nay</b> for 5 minutes.</li>
          <li>After the deadline, anyone may execute:
            if Yay &gt; Nay the DAO auto‑purchases; otherwise it simply closes.</li>
        </ul>
      </div>
    </section>
  );
}
