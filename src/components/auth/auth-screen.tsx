'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import { apiFetch } from '@/lib/api'
import { Loader2, Mail, Lock, User, Phone, Gift, ArrowRight, Sparkles, Users, MessageCircle, Shield } from 'lucide-react'

export function AuthScreen() {
  const { setAuth } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [suName, setSuName] = useState('')
  const [suUsername, setSuUsername] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [suReferral, setSuReferral] = useState('')

  const [phoneMode, setPhoneMode] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const scrollToForm = () => {
    document.getElementById('taly-auth-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast({ title: 'Missing fields', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      setAuth(res.user, res.token)
      toast({ title: 'Welcome back!' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (!suName || !suUsername || !suEmail || !suPassword) {
      toast({ title: 'All fields are required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: suName,
          username: suUsername,
          email: suEmail,
          password: suPassword,
          referralCode: suReferral || undefined,
        }),
      })
      setAuth(res.user, res.token)
      toast({ title: 'Welcome to TalyChat!' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const email = window.prompt('Enter your Gmail address (simulating Google OAuth):')
    if (!email) return
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google', email, name: email.split('@')[0] }),
      })
      setAuth(res.user, res.token)
      toast({ title: 'Signed in with Google' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = () => {
    if (!phone || phone.length < 10) {
      toast({ title: 'Enter valid phone number', variant: 'destructive' })
      return
    }
    setOtpSent(true)
    toast({ title: 'OTP sent (demo: 123456)' })
  }

  const handleVerifyOtp = async () => {
    if (otp !== '123456') {
      toast({ title: 'Invalid OTP. Use 123456', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({ provider: 'phone', phone, name: `User${phone.slice(-4)}` }),
      })
      setAuth(res.user, res.token)
      toast({ title: 'Phone verified!' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="taly-shell min-h-[100dvh] bg-background">
      <section className="relative flex flex-col items-center justify-start overflow-hidden px-6 pt-12 pb-10 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <img src="/logo.png" alt="TalyChat" className="h-20 w-20 rounded-2xl shadow-xl" />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                TalyChat
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Chat. Connect. Mingle.</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={scrollToForm} className="btn-brand gap-2 px-6 py-5">
              Sign up
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button onClick={scrollToForm} variant="outline" className="px-6 py-5">
              Login
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 w-full max-w-md"
        >
          <Feature icon={<MessageCircle className="h-4 w-4" />} label="Private P2P chats" />
          <Feature icon={<Users className="h-4 w-4" />} label="Join communities" />
          <Feature icon={<Shield className="h-4 w-4" />} label="Privacy first" />
        </motion.div>
      </section>

      <section id="taly-auth-form" className="scroll-pan-y mx-auto w-full max-w-md px-6 pb-12">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="le">Email or admin.in</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="le" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com or admin.in"
                    className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lp">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="lp" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••" className="pl-9" />
                </div>
              </div>
              <Button onClick={handleLogin} disabled={loading} className="btn-brand w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Login'}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sn">Full Name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="sn" value={suName} onChange={(e) => setSuName(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su">Username</Label>
                <Input id="su" value={suUsername} onChange={(e) => setSuUsername(e.target.value)} placeholder="unique_handle" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="se">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="se" type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="sp" type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr">Referral Code (optional)</Label>
                <div className="relative">
                  <Gift className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="sr" value={suReferral} onChange={(e) => setSuReferral(e.target.value)} className="pl-9" placeholder="username" />
                </div>
              </div>
              <Button onClick={handleSignup} disabled={loading} className="btn-brand w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
              </Button>
            </TabsContent>
          </Tabs>

          {!phoneMode ? (
            <div className="mt-4 space-y-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                <GoogleIcon /> Continue with Google
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setPhoneMode(true)}>
                <Phone className="h-4 w-4" /> Continue with Phone
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <Label>Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
              {!otpSent ? (
                <Button variant="outline" className="w-full" onClick={handleSendOtp}>Send OTP</Button>
              ) : (
                <>
                  <Label>6-digit OTP</Label>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} />
                  <Button onClick={handleVerifyOtp} disabled={loading} className="btn-brand w-full">Verify</Button>
                </>
              )}
              <Button variant="ghost" className="w-full text-xs" onClick={() => setPhoneMode(false)}>
                ← Back to email login
              </Button>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Sparkles className="inline h-3 w-3" /> Founded by Omkar Panday
          </p>
        </div>
      </section>
    </div>
  )
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-xs">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 35.179 44 30.018 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}
