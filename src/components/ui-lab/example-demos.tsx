import { useState } from "react"
import {
  ArrowBigUp,
  Bold,
  Check,
  Italic,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Send,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { GithubIcon } from "@/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import CheckboxButton from "@/components/checkbox-button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InlineAlert } from "@/components/inline-alert"
import { Input } from "@/components/ui/input"
import { Label, LabelDescription, LabelWrapper } from "@/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { LabItem } from "./types"
import { Preview } from "./parts"

/** Examples render into a single, centered preview surface. */
function ExampleStage({ children }: { children: React.ReactNode }) {
  return (
    <Preview center className="min-h-72 p-8">
      {children}
    </Preview>
  )
}

/* ------------------------------------------------------------------ */
/* Sign in                                                            */
/* ------------------------------------------------------------------ */

function SignInExample() {
  return (
    <ExampleStage>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sign in to Kino</CardTitle>
          <CardDescription>
            Welcome back. Enter your details to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full">
            <GithubIcon />
            Continue with GitHub
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
          <div>
            <LabelWrapper>
              <Label htmlFor="ex-email">Email</Label>
            </LabelWrapper>
            <Input id="ex-email" type="email" placeholder="you@example.com" />
          </div>
          <div>
            <LabelWrapper>
              <Label htmlFor="ex-pass">Password</Label>
            </LabelWrapper>
            <Input id="ex-pass" type="password" placeholder="••••••••" />
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox defaultChecked size="sm" />
            Remember me for 30 days
          </label>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button className="w-full" onClick={() => toast.success("Signed in")}>
            Sign in
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a
              href="#"
              className="text-foreground underline underline-offset-4"
            >
              Sign up
            </a>
          </p>
        </CardFooter>
      </Card>
    </ExampleStage>
  )
}

/* ------------------------------------------------------------------ */
/* Feedback item                                                      */
/* ------------------------------------------------------------------ */

function FeedbackItemExample() {
  const [voted, setVoted] = useState(false)
  const votes = 128 + (voted ? 1 : 0)
  return (
    <ExampleStage>
      <Card className="w-full max-w-md py-4">
        <CardContent className="flex gap-4">
          <button
            type="button"
            onClick={() => setVoted((v) => !v)}
            aria-pressed={voted}
            className={
              "flex h-fit flex-col items-center rounded-lg border px-3 py-1.5 text-sm transition-colors " +
              (voted
                ? "border-primary bg-primary/5 text-primary"
                : "hover:bg-muted/60")
            }
          >
            <ArrowBigUp className="size-4" />
            <span className="font-medium tabular-nums">{votes}</span>
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="leading-tight font-medium">
                  Dark mode for the dashboard
                </p>
                <p className="text-sm text-muted-foreground">
                  It would be great to have a system-aware dark theme across the
                  whole app, especially the analytics views.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Pin to top</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                <Check className="size-3" />
                Planned
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="size-3.5" />
                12 comments
              </span>
              <div className="ml-auto flex -space-x-2">
                <Avatar className="size-6 border-2 border-card">
                  <AvatarFallback className="text-[10px]">ND</AvatarFallback>
                </Avatar>
                <Avatar className="size-6 border-2 border-card">
                  <AvatarFallback className="text-[10px]">JD</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ExampleStage>
  )
}

/* ------------------------------------------------------------------ */
/* Project settings panel                                             */
/* ------------------------------------------------------------------ */

const VISIBILITY = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Team only", value: "team" },
]

function SettingsPanelExample() {
  const [visibility, setVisibility] = useState("public")
  return (
    <ExampleStage>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Project settings</CardTitle>
          <CardDescription>
            Manage how your project appears to others.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <LabelWrapper>
                <Label htmlFor="ex-name">Display name</Label>
              </LabelWrapper>
              <Input id="ex-name" defaultValue="Blinking" />
            </div>
            <div>
              <LabelWrapper>
                <Label>Visibility</Label>
              </LabelWrapper>
              <Select
                items={VISIBILITY}
                value={visibility}
                onValueChange={(v) => setVisibility(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose visibility" />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <LabelWrapper>
              <Label htmlFor="ex-desc">Description</Label>
              <LabelDescription>
                Shown on the public project page.
              </LabelDescription>
            </LabelWrapper>
            <Textarea
              id="ex-desc"
              defaultValue="A roadmap and feedback board for the Blinking app."
            />
          </div>
          <Separator />
          <InlineAlert variant="danger">
            <div className="flex items-center justify-between gap-3">
              <span>
                <strong>Danger zone.</strong> Deleting is permanent.
              </span>
              <Dialog>
                <DialogTrigger
                  render={<Button variant="destructive" size="sm" />}
                >
                  Delete
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete project?</DialogTitle>
                    <DialogDescription>
                      This permanently removes the project and all of its data.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <DialogClose render={<Button variant="destructive" />}>
                      Delete
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </InlineAlert>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button variant="ghost">Cancel</Button>
          <Button onClick={() => toast.success("Settings saved")}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </ExampleStage>
  )
}

/* ------------------------------------------------------------------ */
/* Comment composer                                                   */
/* ------------------------------------------------------------------ */

function CommentComposerExample() {
  const [value, setValue] = useState("")
  return (
    <ExampleStage>
      <div className="flex w-full max-w-md gap-3">
        <Avatar className="size-9 border">
          <AvatarImage
            src="https://avatars.githubusercontent.com/u/124599?v=4"
            alt="@you"
          />
          <AvatarFallback>ND</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2 rounded-xl border bg-card p-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Leave a comment..."
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <div className="flex items-center justify-between">
            <TooltipProvider>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Bold">
                      <Bold />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bold</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Italic">
                      <Italic />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Italic</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Link">
                      <Link2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add link</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Button
              size="sm"
              disabled={value.trim().length === 0}
              onClick={() => {
                toast.success("Comment posted")
                setValue("")
              }}
            >
              <Send />
              Comment
            </Button>
          </div>
        </div>
      </div>
    </ExampleStage>
  )
}

/* ------------------------------------------------------------------ */
/* Plan picker                                                        */
/* ------------------------------------------------------------------ */

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "For side projects.",
    features: ["1 project", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    blurb: "For growing teams.",
    features: ["Unlimited projects", "Analytics", "Priority support"],
  },
  {
    id: "team",
    name: "Team",
    price: "$29",
    blurb: "For organizations.",
    features: ["Everything in Pro", "SSO", "Audit log"],
  },
]

function PlanPickerExample() {
  const [plan, setPlan] = useState("pro")
  return (
    <ExampleStage>
      <div className="grid w-full gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const active = plan === p.id
          return (
            <Card
              key={p.id}
              className={
                "gap-3 py-4 transition-colors " +
                (active ? "border-primary ring-1 ring-primary/30" : "")
              }
            >
              <CardHeader className="px-4">
                <CardTitle className="flex items-center justify-between text-base">
                  {p.name}
                  {p.id === "pro" && (
                    <Badge>
                      <Sparkles className="size-3" />
                      Popular
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{p.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <p className="mb-3">
                  <span className="text-2xl font-semibold tracking-tight">
                    {p.price}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="px-4">
                <CheckboxButton
                  checked={active}
                  onChange={() => setPlan(p.id)}
                  className="w-full justify-center"
                >
                  {active ? "Selected" : "Choose"}
                </CheckboxButton>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </ExampleStage>
  )
}

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

function NotificationsExample() {
  return (
    <ExampleStage>
      <div className="w-full max-w-sm space-y-3">
        <InlineAlert variant="info" size="sm">
          <strong>@jane</strong> mentioned you in a comment.
        </InlineAlert>
        <InlineAlert variant="success" size="sm">
          Your update <strong>“v2.4 release”</strong> was published.
        </InlineAlert>
        <InlineAlert variant="warning" size="sm">
          Your GitHub token expires in 3 days.
        </InlineAlert>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm">
            Dismiss all
          </Button>
          <Button size="sm" onClick={() => toast("Marked all as read")}>
            Mark read
          </Button>
        </div>
      </div>
    </ExampleStage>
  )
}

export const EXAMPLE_ITEMS: LabItem[] = [
  {
    id: "sign-in",
    name: "Sign in",
    description:
      "Card, inputs, checkbox and buttons combined into an auth form.",
    importCode: `import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label, LabelWrapper } from "@/components/label"
import { Separator } from "@/components/ui/separator"`,
    render: () => <SignInExample />,
  },
  {
    id: "feedback-item",
    name: "Feedback item",
    description: "Vote control, status badge, avatars and an actions menu.",
    importCode: `import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"`,
    render: () => <FeedbackItemExample />,
  },
  {
    id: "settings-panel",
    name: "Settings panel",
    description: "Labels, select, textarea, alert and a destructive dialog.",
    importCode: `import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { InlineAlert } from "@/components/inline-alert"
import { Input } from "@/components/ui/input"
import { Label, LabelWrapper } from "@/components/label"
import { Select, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"`,
    render: () => <SettingsPanelExample />,
  },
  {
    id: "comment-composer",
    name: "Comment composer",
    description: "Avatar, textarea and a tooltip toolbar with a submit button.",
    importCode: `import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"`,
    render: () => <CommentComposerExample />,
  },
  {
    id: "plan-picker",
    name: "Plan picker",
    description: "Selectable cards built from checkbox buttons and badges.",
    importCode: `import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import CheckboxButton from "@/components/checkbox-button"`,
    render: () => <PlanPickerExample />,
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "A stack of inline alerts with batch actions and toasts.",
    importCode: `import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { InlineAlert } from "@/components/inline-alert"`,
    render: () => <NotificationsExample />,
  },
]
