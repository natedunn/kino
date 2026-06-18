import { useState } from "react"
import {
  Bell,
  Bold,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Copy,
  CreditCard,
  Italic,
  Mail,
  Plus,
  Search,
  Settings,
  Smile,
  Trash2,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { GithubIcon } from "@/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import CheckboxButton from "@/components/checkbox-button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InlineAlert } from "@/components/inline-alert"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label, LabelDescription, LabelWrapper } from "@/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { LabItem } from "./types"
import { Cell, Demo } from "./parts"

/* ------------------------------------------------------------------ */
/* Buttons                                                            */
/* ------------------------------------------------------------------ */

function ButtonDemo() {
  return (
    <>
      <Demo title="Variants">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Demo>
      <Demo title="Sizes">
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="xl">Extra large</Button>
        <Button size="icon" aria-label="Settings">
          <Settings />
        </Button>
        <Button size="icon-xl" aria-label="Large settings">
          <Settings />
        </Button>
      </Demo>
      <Demo title="With icons">
        <Button>
          <Plus />
          New project
        </Button>
        <Button variant="outline">
          <GithubIcon />
          Continue with GitHub
        </Button>
        <Button variant="destructive">
          <Trash2 />
          Delete
        </Button>
      </Demo>
      <Demo title="Disabled">
        <Button disabled>Default</Button>
        <Button variant="outline" disabled>
          Outline
        </Button>
        <Button variant="destructive" disabled>
          Destructive
        </Button>
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Badges                                                             */
/* ------------------------------------------------------------------ */

function BadgeDemo() {
  return (
    <>
      <Demo title="Variants">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </Demo>
      <Demo title="In context">
        <Badge variant="secondary">
          <Check className="size-3" />
          Shipped
        </Badge>
        <Badge variant="outline">v2.4.0</Badge>
        <Badge>
          <Bell className="size-3" />4 new
        </Badge>
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Avatar                                                             */
/* ------------------------------------------------------------------ */

function AvatarDemo() {
  return (
    <Demo title="Image, fallback & sizes">
      <Avatar className="size-12">
        <AvatarImage
          src="https://avatars.githubusercontent.com/u/124599?v=4"
          alt="@torvalds"
        />
        <AvatarFallback>LT</AvatarFallback>
      </Avatar>
      <Avatar className="size-10">
        <AvatarFallback>ND</AvatarFallback>
      </Avatar>
      <Avatar className="size-8 border">
        <AvatarFallback>
          <User className="size-4" />
        </AvatarFallback>
      </Avatar>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Card                                                               */
/* ------------------------------------------------------------------ */

function CardDemo() {
  return (
    <Demo title="Anatomy" center>
      <Card className="w-full max-w-sm">
        <CardHeader className="border-b">
          <CardTitle>Upgrade your plan</CardTitle>
          <CardDescription>You are currently on the free plan.</CardDescription>
          <CardAction>
            <Badge variant="secondary">Free</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Unlock unlimited projects, advanced analytics and priority support
          when you upgrade to Pro.
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button variant="ghost">Maybe later</Button>
          <Button>Upgrade</Button>
        </CardFooter>
      </Card>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Inline alert                                                       */
/* ------------------------------------------------------------------ */

function InlineAlertDemo() {
  return (
    <>
      <Demo title="Variants" className="flex-col items-stretch">
        <InlineAlert variant="default">
          <strong>Heads up.</strong> This is a neutral, default alert.
        </InlineAlert>
        <InlineAlert variant="info">
          <strong>Info.</strong> A new version is available to install.
        </InlineAlert>
        <InlineAlert variant="success">
          <strong>Success.</strong> Your changes have been saved.
        </InlineAlert>
        <InlineAlert variant="warning">
          <strong>Warning.</strong> Your trial ends in 3 days.
        </InlineAlert>
        <InlineAlert variant="danger">
          <strong>Danger.</strong> This action cannot be undone.
        </InlineAlert>
      </Demo>
      <Demo title="Sizes" className="flex-col items-stretch">
        <InlineAlert size="lg" variant="info">
          Large alert
        </InlineAlert>
        <InlineAlert size="xl" variant="info">
          Extra large alert
        </InlineAlert>
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                           */
/* ------------------------------------------------------------------ */

function CheckboxDemo() {
  const [checked, setChecked] = useState(true)
  return (
    <>
      <Demo title="Sizes">
        <Cell label="xs">
          <Checkbox size="xs" defaultChecked />
        </Cell>
        <Cell label="sm">
          <Checkbox size="sm" defaultChecked />
        </Cell>
        <Cell label="default">
          <Checkbox size="default" defaultChecked />
        </Cell>
        <Cell label="lg">
          <Checkbox size="lg" defaultChecked />
        </Cell>
        <Cell label="xl">
          <Checkbox size="xl" defaultChecked />
        </Cell>
      </Demo>
      <Demo title="States & label">
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
          />
          Subscribe to the newsletter
        </label>
        <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Checkbox disabled />
          Disabled
        </label>
        <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Checkbox disabled defaultChecked />
          Disabled checked
        </label>
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Checkbox button                                                    */
/* ------------------------------------------------------------------ */

function CheckboxButtonDemo() {
  const [selected, setSelected] = useState<string[]>(["weekly"])
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  return (
    <>
      <Demo title="Selectable chips">
        {[
          { id: "daily", label: "Daily digest" },
          { id: "weekly", label: "Weekly summary" },
          { id: "mentions", label: "Mentions only" },
        ].map((opt) => (
          <CheckboxButton
            key={opt.id}
            checked={selected.includes(opt.id)}
            onChange={() => toggle(opt.id)}
          >
            {opt.label}
          </CheckboxButton>
        ))}
      </Demo>
      <Demo title="Sizes">
        <CheckboxButton size="lg" defaultChecked>
          Large
        </CheckboxButton>
        <CheckboxButton size="xl" defaultChecked>
          Extra large
        </CheckboxButton>
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Input                                                              */
/* ------------------------------------------------------------------ */

function InputDemo() {
  return (
    <>
      <Demo title="Sizes" className="flex-col items-stretch sm:max-w-sm">
        <Input size="xs" placeholder="Extra small" />
        <Input size="sm" placeholder="Small" />
        <Input size="default" placeholder="Default" />
        <Input size="lg" placeholder="Large" />
        <Input size="xl" placeholder="Extra large" />
      </Demo>
      <Demo title="States" className="flex-col items-stretch sm:max-w-sm">
        <Input placeholder="Disabled" disabled />
        <Input placeholder="Invalid" aria-invalid defaultValue="not-an-email" />
        <Input type="password" defaultValue="hunter2" />
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Textarea                                                           */
/* ------------------------------------------------------------------ */

function TextareaDemo() {
  return (
    <Demo title="Sizes" className="flex-col items-stretch sm:max-w-md">
      <Textarea size="sm" placeholder="Small textarea" />
      <Textarea placeholder="Default textarea" />
      <Textarea size="lg" placeholder="Large textarea" />
      <Textarea size="xl" placeholder="Extra large textarea" />
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Input group                                                        */
/* ------------------------------------------------------------------ */

function InputGroupDemo() {
  return (
    <>
      <Demo title="Leading icon" className="flex-col items-stretch sm:max-w-sm">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search projects..." />
        </InputGroup>
      </Demo>
      <Demo
        title="Trailing action"
        className="flex-col items-stretch sm:max-w-sm"
      >
        <InputGroup>
          <InputGroupInput
            placeholder="https://kino.app/invite/x8f2"
            readOnly
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={() => toast.success("Copied to clipboard")}
            >
              <Copy />
              Copy
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Demo>
      <Demo title="Sizes" className="flex-col items-stretch sm:max-w-sm">
        <InputGroup size="lg">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Large grouped input" />
        </InputGroup>
        <InputGroup size="xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Extra large grouped input" />
        </InputGroup>
      </Demo>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Label                                                              */
/* ------------------------------------------------------------------ */

function LabelDemo() {
  return (
    <Demo title="Field label" className="flex-col items-stretch sm:max-w-sm">
      <div>
        <LabelWrapper>
          <Label htmlFor="lab-email">Email address</Label>
          <LabelDescription>
            We&apos;ll never share it with anyone.
          </LabelDescription>
        </LabelWrapper>
        <Input id="lab-email" type="email" placeholder="you@example.com" />
      </div>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Select                                                             */
/* ------------------------------------------------------------------ */

const FRUITS = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Blueberry", value: "blueberry" },
  { label: "Grapes", value: "grapes" },
  { label: "Pineapple", value: "pineapple" },
]

function SelectDemo() {
  const [value, setValue] = useState("")
  return (
    <Demo title="Single select" center>
      <Select
        items={FRUITS}
        value={value}
        onValueChange={(v) => setValue(v as string)}
      >
        <SelectTrigger className="w-60">
          <SelectValue placeholder="Pick a fruit" />
        </SelectTrigger>
        <SelectContent>
          {FRUITS.map((fruit) => (
            <SelectItem key={fruit.value} value={fruit.value}>
              {fruit.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={FRUITS}
        value={value}
        onValueChange={(v) => setValue(v as string)}
      >
        <SelectTrigger className="w-64" size="xl">
          <SelectValue placeholder="Extra large select" />
        </SelectTrigger>
        <SelectContent>
          {FRUITS.map((fruit) => (
            <SelectItem key={fruit.value} value={fruit.value}>
              {fruit.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Dropdown menu                                                      */
/* ------------------------------------------------------------------ */

function DropdownMenuDemo() {
  const [notifications, setNotifications] = useState(true)
  return (
    <Demo title="Menu" center>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Open menu
            <ChevronsUpDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User />
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={notifications}
            onCheckedChange={(v) => setNotifications(v === true)}
          >
            Email notifications
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Dialog                                                             */
/* ------------------------------------------------------------------ */

function DialogDemo() {
  return (
    <Demo title="Modal dialog" center>
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>
          Delete project
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              This permanently removes the project and all of its feedback,
              updates and discussions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <DialogClose render={<Button variant="destructive" />}>
              Delete project
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet                                                              */
/* ------------------------------------------------------------------ */

function SheetDemo() {
  return (
    <Demo title="Slide-over panel" center>
      {(["right", "left", "top", "bottom"] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger render={<Button variant="outline" />}>
            {side}
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Edit profile</SheetTitle>
              <SheetDescription>
                Make changes to your profile here. Click save when you&apos;re
                done.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4">
              <Input placeholder="Display name" defaultValue="Nate Dunn" />
              <Input placeholder="Username" defaultValue="natedunn" />
            </div>
            <SheetFooter>
              <Button>Save changes</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Popover                                                            */
/* ------------------------------------------------------------------ */

function PopoverDemo() {
  return (
    <Demo title="Popover" center>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Open popover</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium">Dimensions</h4>
              <p className="text-xs text-muted-foreground">
                Set the dimensions for the layer.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="lab-width">Width</Label>
                <Input
                  id="lab-width"
                  size="sm"
                  defaultValue="100%"
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="lab-height">Height</Label>
                <Input
                  id="lab-height"
                  size="sm"
                  defaultValue="25px"
                  className="col-span-2"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                            */
/* ------------------------------------------------------------------ */

function TooltipDemo() {
  return (
    <Demo title="Tooltip" center>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Tooltip on the bottom</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Collapsible                                                        */
/* ------------------------------------------------------------------ */

function CollapsibleDemo() {
  const [open, setOpen] = useState(false)
  return (
    <Demo title="Collapsible" className="flex-col items-stretch sm:max-w-sm">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="w-full space-y-2"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">@natedunn starred 3 repos</span>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Toggle">
                <ChevronsUpDown />
              </Button>
            }
          />
        </div>
        <div className="rounded-md border px-3 py-2 font-mono text-sm">
          @kino/relay
        </div>
        <CollapsibleContent className="space-y-2">
          <div className="rounded-md border px-3 py-2 font-mono text-sm">
            @kino/gateway
          </div>
          <div className="rounded-md border px-3 py-2 font-mono text-sm">
            @kino/blinking
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Breadcrumb                                                         */
/* ------------------------------------------------------------------ */

function BreadcrumbDemo() {
  return (
    <Demo title="Breadcrumb">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Kino</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Blinking</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Separator                                                          */
/* ------------------------------------------------------------------ */

function SeparatorDemo() {
  return (
    <Demo title="Horizontal & vertical">
      <div className="w-full max-w-sm space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Kino UI</p>
          <p className="text-xs text-muted-foreground">A component library.</p>
        </div>
        <Separator />
        <div className="flex h-5 items-center gap-3 text-sm">
          <span>Docs</span>
          <Separator orientation="vertical" />
          <span>Components</span>
          <Separator orientation="vertical" />
          <span>Examples</span>
        </div>
      </div>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonDemo() {
  return (
    <Demo title="Loading placeholder">
      <div className="flex w-full max-w-sm items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Calendar                                                           */
/* ------------------------------------------------------------------ */

function CalendarDemo() {
  const [date, setDate] = useState<Date | undefined>(undefined)
  return (
    <Demo title="Date picker" center>
      <Calendar
        mode="single"
        selected={date}
        onSelect={(d) => setDate(d)}
        className="rounded-xl border"
      />
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Command                                                            */
/* ------------------------------------------------------------------ */

function CommandDemo() {
  return (
    <Demo title="Command menu" center>
      <Command className="w-full max-w-sm rounded-xl border shadow-sm">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <CalendarIcon />
              Calendar
            </CommandItem>
            <CommandItem>
              <Smile />
              Search emoji
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <User />
              Profile
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Mail />
              Mail
              <CommandShortcut>⌘M</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings />
              Settings
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Toast (Sonner)                                                     */
/* ------------------------------------------------------------------ */

function ToastDemo() {
  return (
    <Demo title="Toasts">
      <Button variant="outline" onClick={() => toast("Event has been created")}>
        Default
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.success("Changes saved successfully")}
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Something went wrong")}
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Project archived", {
            description: "You can restore it from settings.",
            action: { label: "Undo", onClick: () => toast("Restored") },
          })
        }
      >
        With action
      </Button>
    </Demo>
  )
}

/* ------------------------------------------------------------------ */
/* Text formatting / extras                                           */
/* ------------------------------------------------------------------ */

function ToggleRowDemo() {
  return (
    <Demo title="Toolbar (ghost buttons)" center>
      <div className="flex items-center gap-1 rounded-lg border p-1">
        <Button variant="ghost" size="icon" aria-label="Bold">
          <Bold />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Italic">
          <Italic />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button variant="ghost" size="sm">
          Paragraph
        </Button>
      </div>
    </Demo>
  )
}

export const COMPONENT_ITEMS: LabItem[] = [
  {
    id: "button",
    name: "Button",
    description: "Clickable actions with six variants and five sizes.",
    tag: "6 variants",
    importCode: `import { Button } from "@/components/ui/button"`,
    render: () => <ButtonDemo />,
  },
  {
    id: "badge",
    name: "Badge",
    description: "Compact status and metadata labels.",
    importCode: `import { Badge } from "@/components/ui/badge"`,
    render: () => <BadgeDemo />,
  },
  {
    id: "avatar",
    name: "Avatar",
    description: "User images with graceful fallbacks.",
    importCode: `import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"`,
    render: () => <AvatarDemo />,
  },
  {
    id: "card",
    name: "Card",
    description: "A flexible surface with header, content and footer slots.",
    importCode: `import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"`,
    render: () => <CardDemo />,
  },
  {
    id: "inline-alert",
    name: "Inline Alert",
    description: "Inline callouts for info, success, warning and danger.",
    tag: "5 variants",
    importCode: `import { InlineAlert } from "@/components/inline-alert"`,
    render: () => <InlineAlertDemo />,
  },
  {
    id: "checkbox",
    name: "Checkbox",
    description: "Boolean input in four sizes.",
    importCode: `import { Checkbox } from "@/components/ui/checkbox"`,
    render: () => <CheckboxDemo />,
  },
  {
    id: "checkbox-button",
    name: "Checkbox Button",
    description: "A larger, button-style multi-select chip.",
    importCode: `import CheckboxButton from "@/components/checkbox-button"`,
    render: () => <CheckboxButtonDemo />,
  },
  {
    id: "input",
    name: "Input",
    description: "Single-line text field with sizes and invalid state.",
    importCode: `import { Input } from "@/components/ui/input"`,
    render: () => <InputDemo />,
  },
  {
    id: "textarea",
    name: "Textarea",
    description: "Multi-line text field with sizes.",
    importCode: `import { Textarea } from "@/components/ui/textarea"`,
    render: () => <TextareaDemo />,
  },
  {
    id: "input-group",
    name: "Input Group",
    description: "Inputs composed with leading/trailing addons and buttons.",
    importCode: `import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"`,
    render: () => <InputGroupDemo />,
  },
  {
    id: "label",
    name: "Label",
    description: "Accessible field labels with descriptions.",
    importCode: `import { Label, LabelDescription, LabelWrapper } from "@/components/label"`,
    render: () => <LabelDemo />,
  },
  {
    id: "select",
    name: "Select",
    description: "A styled dropdown for choosing a single value.",
    importCode: `import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"`,
    render: () => <SelectDemo />,
  },
  {
    id: "dropdown-menu",
    name: "Dropdown Menu",
    description: "Contextual menus with items, checkboxes and shortcuts.",
    importCode: `import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"`,
    render: () => <DropdownMenuDemo />,
  },
  {
    id: "dialog",
    name: "Dialog",
    description: "Modal dialog for focused tasks and confirmations.",
    importCode: `import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"`,
    render: () => <DialogDemo />,
  },
  {
    id: "sheet",
    name: "Sheet",
    description: "Slide-over panel anchored to any edge.",
    importCode: `import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"`,
    render: () => <SheetDemo />,
  },
  {
    id: "popover",
    name: "Popover",
    description: "Floating content anchored to a trigger.",
    importCode: `import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"`,
    render: () => <PopoverDemo />,
  },
  {
    id: "tooltip",
    name: "Tooltip",
    description: "Hover hints with an arrow.",
    importCode: `import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"`,
    render: () => <TooltipDemo />,
  },
  {
    id: "collapsible",
    name: "Collapsible",
    description: "Show and hide content with a trigger.",
    importCode: `import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"`,
    render: () => <CollapsibleDemo />,
  },
  {
    id: "breadcrumb",
    name: "Breadcrumb",
    description: "Hierarchy and navigation trail.",
    importCode: `import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"`,
    render: () => <BreadcrumbDemo />,
  },
  {
    id: "separator",
    name: "Separator",
    description: "Horizontal and vertical dividers.",
    importCode: `import { Separator } from "@/components/ui/separator"`,
    render: () => <SeparatorDemo />,
  },
  {
    id: "skeleton",
    name: "Skeleton",
    description: "Animated loading placeholders.",
    importCode: `import { Skeleton } from "@/components/ui/skeleton"`,
    render: () => <SkeletonDemo />,
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Date picker built on react-day-picker.",
    importCode: `import { Calendar } from "@/components/ui/calendar"`,
    render: () => <CalendarDemo />,
  },
  {
    id: "command",
    name: "Command",
    description: "Command palette list with search and groups.",
    importCode: `import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"`,
    render: () => <CommandDemo />,
  },
  {
    id: "toast",
    name: "Toast",
    description: "Transient notifications powered by Sonner.",
    importCode: `import { toast } from "sonner"`,
    render: () => <ToastDemo />,
  },
  {
    id: "toolbar",
    name: "Toolbar",
    description: "Icon button groups for editor-style toolbars.",
    importCode: `import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"`,
    render: () => <ToggleRowDemo />,
  },
]
