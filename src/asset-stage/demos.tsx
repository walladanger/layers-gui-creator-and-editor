// Live demos for the catalog in src/features/assets/catalog.ts, one per id. Each mirrors its `usage`.
import type { ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Attachment, AttachmentActions, AttachmentAction, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from './ui/attachment';
import { FileText, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Toggle } from './ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

/** Extra variants shown under the main demo, so their looks can be compared. */
export const DEMOS: Record<string, { main: () => ReactNode; more?: () => ReactNode }> = {
  'shadcn:button': {
    main: () => <Button>Save changes</Button>,
    more: () => <div className="flex flex-wrap gap-2">
      {(['secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map((v) => <Button key={v} variant={v}>{v[0].toUpperCase() + v.slice(1)}</Button>)}
      <Button size="sm">Small</Button><Button size="lg">Large</Button>
    </div>,
  },
  'shadcn:badge': {
    main: () => <Badge variant="secondary">New</Badge>,
    more: () => <div className="flex gap-2"><Badge>Default</Badge><Badge variant="outline">Outline</Badge><Badge variant="destructive">Error</Badge></div>,
  },
  'shadcn:card': {
    main: () => <Card className="w-80">
      <CardHeader><CardTitle>Upgrade plan</CardTitle><CardDescription>Unlock unlimited projects.</CardDescription></CardHeader>
      <CardContent>Everything in Free, plus team sharing.</CardContent>
      <CardFooter><Button className="w-full">Upgrade</Button></CardFooter>
    </Card>,
  },
  'shadcn:alert': {
    main: () => <Alert className="w-96"><AlertTitle>Heads up!</AlertTitle><AlertDescription>You can add components to your app from here.</AlertDescription></Alert>,
    more: () => <Alert variant="destructive" className="w-96"><AlertTitle>Something went wrong</AlertTitle><AlertDescription>Your session has expired.</AlertDescription></Alert>,
  },
  'shadcn:input': { main: () => <Input type="email" placeholder="Email" className="w-72" /> },
  'shadcn:textarea': { main: () => <Textarea placeholder="Type your message here." className="w-80" /> },
  'shadcn:label': { main: () => <Label htmlFor="email">Email</Label> },
  'shadcn:checkbox': { main: () => <div className="flex items-center gap-2"><Checkbox id="terms" /><Label htmlFor="terms">Accept terms</Label></div> },
  'shadcn:switch': { main: () => <div className="flex items-center gap-2"><Switch id="airplane" /><Label htmlFor="airplane">Airplane mode</Label></div> },
  'shadcn:radio-group': {
    main: () => <RadioGroup defaultValue="comfortable">
      <div className="flex items-center gap-2"><RadioGroupItem value="default" id="r1" /><Label htmlFor="r1">Default</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="comfortable" id="r2" /><Label htmlFor="r2">Comfortable</Label></div>
    </RadioGroup>,
  },
  'shadcn:select': {
    main: () => <Select>
      <SelectTrigger className="w-48"><SelectValue placeholder="Theme" /></SelectTrigger>
      <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent>
    </Select>,
  },
  'shadcn:slider': { main: () => <Slider defaultValue={[50]} max={100} step={1} className="w-60" /> },
  'shadcn:toggle': { main: () => <Toggle aria-label="Bold">B</Toggle> },
  'shadcn:tabs': {
    main: () => <Tabs defaultValue="account" className="w-80">
      <TabsList><TabsTrigger value="account">Account</TabsTrigger><TabsTrigger value="password">Password</TabsTrigger></TabsList>
      <TabsContent value="account">Change your account details here.</TabsContent>
      <TabsContent value="password">Change your password here.</TabsContent>
    </Tabs>,
  },
  'shadcn:accordion': {
    main: () => <Accordion type="single" collapsible defaultValue="returns" className="w-full max-w-md">
      <AccordionItem value="shipping">
        <AccordionTrigger>What are your shipping options?</AccordionTrigger>
        <AccordionContent>We offer standard (3–5 business days) and express (1–2 business days) shipping.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>What is your return policy?</AccordionTrigger>
        <AccordionContent>Returns accepted within 30 days. Items must be unused and in original packaging. Refunds are processed within 5–7 business days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="support">
        <AccordionTrigger>How can I contact customer support?</AccordionTrigger>
        <AccordionContent>Contact our support team by email or through the help center, Monday through Friday.</AccordionContent>
      </AccordionItem>
    </Accordion>,
  },
  'shadcn:dialog': {
    main: () => <Dialog>
      <DialogTrigger asChild><Button variant="outline">Edit profile</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Make changes to your profile here.</DialogDescription></DialogHeader>
        <DialogFooter><Button>Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>,
  },
  'shadcn:dropdown-menu': {
    main: () => <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline">Open menu</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>My account</DropdownMenuLabel><DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem><DropdownMenuItem>Settings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  },
  'shadcn:tooltip': {
    main: () => <Tooltip><TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger><TooltipContent>Add to library</TooltipContent></Tooltip>,
  },
  'shadcn:attachment': {
    main: () => <Attachment className="w-full max-w-md">
      <AttachmentMedia><FileText aria-hidden="true" /></AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>sales-dashboard.pdf</AttachmentTitle>
        <AttachmentDescription>PDF · 2.4 MB · Ready to share</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="Remove sales-dashboard.pdf"><X aria-hidden="true" /></AttachmentAction>
      </AttachmentActions>
    </Attachment>,
  },
  'shadcn:avatar': {
    main: () => <Avatar><AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" /><AvatarFallback>CN</AvatarFallback></Avatar>,
  },
  'shadcn:progress': { main: () => <Progress value={60} className="w-60" /> },
  'shadcn:skeleton': {
    main: () => <div className="flex items-center gap-3"><Skeleton className="size-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-36" /></div></div>,
  },
  'shadcn:separator': {
    main: () => <div className="w-64"><div className="text-sm font-medium">Radix Primitives</div><Separator className="my-4" /><div className="text-sm text-muted-foreground">An open-source UI library.</div></div>,
  },
};
