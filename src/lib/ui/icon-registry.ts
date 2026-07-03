/**
 * ArcID Icon Registry
 * Central typed map of all Lucide icons used across the system.
 * Import from here — never import from lucide-react directly in pages.
 * Extractable as a standalone package: @arcid/icons
 */
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Key,
  Fingerprint,
  Lock,
  LockOpen,
  Unlock,
  User,
  UserCheck,
  UserX,
  Users,
  UserPlus,
  Building2,
  Layers,
  Globe,
  Link2,
  CreditCard,
  Receipt,
  Wallet,
  FileCheck,
  FileBadge,
  FileX,
  FileKey,
  Activity,
  ScrollText,
  Bell,
  BellOff,
  RefreshCw,
  LogOut,
  LogIn,
  RotateCcw,
  Settings,
  Sliders,
  Wrench,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Search,
  Filter,
  MoreHorizontal,
  Plus,
  Minus,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  Timer,
  Smartphone,
  Monitor,
  Tablet,
  Laptop,
  Database,
  Server,
  Cloud,
  Code2,
  Mail,
  Phone,
  Send,
  Inbox,
  BarChart3,
  TrendingUp,
  PieChart,
  type LucideIcon,
} from "lucide-react";

export const Icons = {
  // Identity & Auth
  shield: Shield,
  shieldCheck: ShieldCheck,
  shieldAlert: ShieldAlert,
  shieldOff: ShieldOff,
  passkey: Fingerprint,
  key: Key,
  lock: Lock,
  lockOpen: LockOpen,
  unlock: Unlock,

  // People
  user: User,
  userCheck: UserCheck,
  userX: UserX,
  users: Users,
  userPlus: UserPlus,

  // Organisation
  tenant: Building2,
  layers: Layers,
  globe: Globe,
  link: Link2,

  // Billing
  billing: CreditCard,
  receipt: Receipt,
  wallet: Wallet,

  // Credentials
  credential: FileCheck,
  badge: FileBadge,
  fileX: FileX,
  fileKey: FileKey,

  // System
  audit: Activity,
  logs: ScrollText,
  bell: Bell,
  bellOff: BellOff,

  // Actions
  refresh: RefreshCw,
  logout: LogOut,
  login: LogIn,
  reset: RotateCcw,

  // Configuration
  settings: Settings,
  sliders: Sliders,
  wrench: Wrench,
  toggleOn: ToggleRight,
  toggleOff: ToggleLeft,

  // Status
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  alertCircle: AlertCircle,
  info: Info,

  // Navigation
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,

  // UI Actions
  copy: Copy,
  show: Eye,
  hide: EyeOff,
  search: Search,
  filter: Filter,
  more: MoreHorizontal,
  plus: Plus,
  minus: Minus,
  close: X,
  check: Check,

  // Time
  calendar: Calendar,
  clock: Clock,
  timer: Timer,

  // Devices
  smartphone: Smartphone,
  monitor: Monitor,
  tablet: Tablet,
  laptop: Laptop,

  // Tech
  database: Database,
  server: Server,
  cloud: Cloud,
  code: Code2,

  // Communication
  mail: Mail,
  phone: Phone,
  send: Send,
  inbox: Inbox,

  // Analytics
  barChart: BarChart3,
  trending: TrendingUp,
  pieChart: PieChart,
} as const;

export type IconName = keyof typeof Icons;
export type { LucideIcon };
