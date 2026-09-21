'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Blocks, Check, ChevronRight, CircleDot, Code2, Github, ShieldCheck, Sparkles, TerminalSquare, Users, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Dashboard from './dashboard/page';
import styles from './page.module.css';

const steps = [
  ['01', 'Request a quote', 'A wallet asks the relay for a bounded sponsorship quote, including fees and expiry.'],
  ['02', 'Sign once', 'The user authorizes the exact token movement—without ever needing to hold STX.'],
  ['03', 'Relay atomically', 'An operator sponsors and broadcasts the transaction, settling its fee in the same flow.'],
];

const principles = [
  { icon: '/lock.svg', title: 'Non-custodial', copy: 'Users sign their own intent. Operators sponsor execution, but never control user funds.' },
  { icon: '/network.svg', title: 'Open operator network', copy: 'A permissionless relay layer designed for resilient routing and transparent competition.' },
  { icon: '/flash.svg', title: 'One seamless action', copy: 'Fees are handled behind the scenes, making Stacks applications feel fast and familiar.' },
];

const connectedAddressKey = 'ossr-ui:connected-stx-address';

function compactAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export default function Home() {
  const [transferOpen, setTransferOpen] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');

  useEffect(() => {
    setConnectedAddress(window.localStorage.getItem(connectedAddressKey) ?? '');
  }, []);

  return <main className={styles.page}>
    <div className={styles.ambient} aria-hidden="true" />
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="OSSR home"><span>OSSR</span></Link>
      <nav className={styles.nav} aria-label="Primary navigation"><a href="#documentation">Documentation</a><a href="#operators">Operators</a><a href="#developers">Developers</a></nav>
      <Button className={styles.connect} onClick={() => setTransferOpen(true)}>{connectedAddress ? compactAddress(connectedAddress) : 'Connect'} <ArrowRight /></Button>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><Sparkles /> Open infrastructure for Stacks</div>
        <h1>Transactions should feel <span>effortless.</span></h1>
        <p className={styles.lede}>OSSR is an open protocol for sponsored Stacks transactions. Users move sBTC without holding STX, while independent operators handle network fees.</p>
        <div className={styles.heroActions}>
          <Button asChild size="lg" className={styles.primary}><Link href="/dashboard">Open dashboard <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="outline" className={styles.secondary}><a href="#documentation">Explore the protocol <ChevronRight /></a></Button>
        </div>
        <div className={styles.trust}><span><Check /> Non-custodial</span><span><Check /> Open source</span><span><Check /> Built for sBTC</span></div>
      </div>
      <div className={styles.visual} aria-label="OSSR transaction flow">
        <div className={styles.glow} />
        <FlowNode className={styles.userNode} icon={<WalletCards />} label="USER WALLET" title="Sign intent" />
        <div className={styles.flow}><span /></div>
        <div className={styles.core}><div className={styles.orbit}><i /><i /><i /></div><b>O</b><small>OSSR PROTOCOL</small><strong>Route + sponsor</strong></div>
        <div className={styles.flow}><span /></div>
        <FlowNode className={styles.chainNode} icon={<Blocks />} label="STACKS" title="Settle onchain" live />
        <div className={styles.chip}><ShieldCheck /> Atomic settlement</div>
      </div>
    </section>

    <section className={styles.stats} aria-label="Protocol characteristics">
      <div><strong>0 STX</strong><span>required by users</span></div><div><strong>1 signature</strong><span>from intent to settlement</span></div><div><strong>100%</strong><span>non-custodial by design</span></div><div><strong>Open</strong><span>protocol and operator network</span></div>
    </section>

    <section id="documentation" className={styles.section}>
      <div className={styles.intro}><span className={styles.kicker}>THE PROTOCOL</span><h2>A better transaction primitive.</h2><p>OSSR separates user intent from fee payment, letting applications deliver gasless experiences without compromising ownership.</p></div>
      <div className={styles.principles}>{principles.map(({icon,title,copy}) => <article key={title} className={styles.principle}><div className={styles.cardIcon}><Image src={icon} alt="" width={30} height={30} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>

    <section className={styles.how}>
      <div className={styles.howHeader}><div><span className={styles.kicker}>HOW IT WORKS</span><h2>Simple for users.<br />Powerful underneath.</h2></div><p>A compact, verifiable flow connects wallets, relay operators, and the Stacks network.</p></div>
      <div className={styles.steps}>{steps.map(([number,title,copy], index) => <article key={number} className={styles.step}><span>{number}</span><div><Image src={index === 0 ? '/quote.svg' : index === 1 ? '/sign.svg' : '/send-bitcoin.svg'} alt="" width={28} height={28} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>

    <section className={styles.paths}>
      <article id="operators" className={styles.path}><div className={styles.cardIcon}><Users /></div><span className={styles.kicker}>FOR OPERATORS</span><h2>Power the relay network.</h2><p>Run infrastructure, sponsor transactions, and help create a more accessible Stacks ecosystem.</p><a href="#documentation">Operator overview <ArrowRight /></a><div className={styles.terminal}><div><i/><i/><i/><span>operator</span></div><code><b>$</b> ossr-operator start</code><code><em>✓</em> connected to stacks-testnet</code><code><em>✓</em> relay ready for quotes</code></div></article>
      <article id="developers" className={styles.path}><div className={styles.cardIcon}><Code2 /></div><span className={styles.kicker}>FOR DEVELOPERS</span><h2>Make gasless feel native.</h2><p>Integrate sponsored sBTC transfers with a small, predictable API designed for modern applications.</p><a href="#documentation">Read the docs <ArrowRight /></a><div className={styles.code}><div><TerminalSquare /><span>request.ts</span></div><pre><span>const</span> quote = <span>await</span> ossr.quote({'{'}{`\n  amount: 1000,\n  token: 'sBTC'\n`}{'}'});</pre></div></article>
    </section>

    <section className={styles.final}><span className={styles.kicker}>READY TO GET STARTED?</span><h2>The open relay layer for Stacks.</h2><p>Connect your wallet and experience sponsored transactions on testnet.</p><Button size="lg" className={styles.primary} onClick={() => setTransferOpen(true)}>Connect to OSSR <ArrowRight /></Button></section>
    <footer className={styles.footer}><div className={styles.brand}><span>OSSR</span></div><p>Open Stacks Sponsor Relay. Built in the open.</p><div><a href="#documentation">Protocol</a><a href="#operators">Operators</a><a href="#developers">Developers</a><a href="https://github.com" aria-label="GitHub"><Github /></a></div></footer>

    <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
      <DialogContent className="w-[min(26.5rem,calc(100vw-1rem))] max-h-[calc(100vh-2rem)] max-w-none overflow-y-auto border-white/15 bg-background/65 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Sponsored sBTC transfer</DialogTitle>
          <DialogDescription>Connect a wallet, request a quote, and approve the sponsored transaction.</DialogDescription>
        </DialogHeader>
        <Dashboard embedded onWalletChange={setConnectedAddress} />
      </DialogContent>
    </Dialog>
  </main>;
}

function FlowNode({className,icon,label,title,live}:{className:string;icon:React.ReactNode;label:string;title:string;live?:boolean}) {
  return <div className={`${styles.node} ${className}`}><div className={styles.nodeIcon}>{icon}</div><div><small>{label}</small><strong>{title}</strong></div>{live?<span className={styles.live}><CircleDot/> LIVE</span>:<i />}</div>;
}
