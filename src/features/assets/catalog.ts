// What the Assets window lists. Pure data, so the studio can show it without loading the components;
// the live demos for these ids live in `src/asset-stage/demos.tsx`.

export type AssetLibrary = 'shadcn' | 'lucide';
export interface AssetEntry {
  id: string;
  library: AssetLibrary;
  name: string;
  description: string;
  category: string;
  /** Command that adds it to an app, when the library has one. */
  install?: string;
  /** Import line(s) for the usage example. */
  importLine: string;
  /** JSX to paste where it should appear. */
  usage: string;
  keywords?: string[];
}

const shadcn = (id: string, name: string, category: string, description: string, exports: string[], usage: string, keywords: string[] = []): AssetEntry => ({
  id: `shadcn:${id}`, library: 'shadcn', name, category, description, keywords,
  install: `npx shadcn@latest add ${id}`,
  importLine: `import { ${exports.join(', ')} } from "@/components/ui/${id}"`,
  usage,
});

export const SHADCN_ASSETS: AssetEntry[] = [
  shadcn('button', 'Button', 'Actions', 'A button in six variants and four sizes.', ['Button'], '<Button>Save changes</Button>', ['action', 'submit', 'cta']),
  shadcn('badge', 'Badge', 'Display', 'A small label for status or counts.', ['Badge'], '<Badge variant="secondary">New</Badge>', ['tag', 'pill', 'status']),
  shadcn('card', 'Card', 'Layout', 'A box with header, content and footer.', ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter'],
    `<Card className="w-80">
  <CardHeader>
    <CardTitle>Upgrade plan</CardTitle>
    <CardDescription>Unlock unlimited projects.</CardDescription>
  </CardHeader>
  <CardContent>Everything in Free, plus team sharing.</CardContent>
  <CardFooter><Button className="w-full">Upgrade</Button></CardFooter>
</Card>`, ['panel', 'tile', 'box']),
  shadcn('alert', 'Alert', 'Feedback', 'A callout for important messages.', ['Alert', 'AlertTitle', 'AlertDescription'],
    `<Alert>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>You can add components to your app from here.</AlertDescription>
</Alert>`, ['notice', 'banner', 'callout']),
  shadcn('input', 'Input', 'Forms', 'A text field.', ['Input'], '<Input type="email" placeholder="Email" />', ['text', 'field']),
  shadcn('textarea', 'Textarea', 'Forms', 'A multi-line text field.', ['Textarea'], '<Textarea placeholder="Type your message here." />', ['multiline', 'message']),
  shadcn('label', 'Label', 'Forms', 'An accessible label for a field.', ['Label'], '<Label htmlFor="email">Email</Label>'),
  shadcn('checkbox', 'Checkbox', 'Forms', 'A box that can be ticked.', ['Checkbox'], `<div className="flex items-center gap-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms</Label>
</div>`, ['tick', 'check']),
  shadcn('switch', 'Switch', 'Forms', 'An on/off toggle.', ['Switch'], `<div className="flex items-center gap-2">
  <Switch id="airplane" />
  <Label htmlFor="airplane">Airplane mode</Label>
</div>`, ['toggle', 'on off']),
  shadcn('radio-group', 'Radio group', 'Forms', 'Pick one of several options.', ['RadioGroup', 'RadioGroupItem'], `<RadioGroup defaultValue="comfortable">
  <div className="flex items-center gap-2"><RadioGroupItem value="default" id="r1" /><Label htmlFor="r1">Default</Label></div>
  <div className="flex items-center gap-2"><RadioGroupItem value="comfortable" id="r2" /><Label htmlFor="r2">Comfortable</Label></div>
</RadioGroup>`, ['option', 'choice']),
  shadcn('select', 'Select', 'Forms', 'A dropdown to pick one value.', ['Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem'], `<Select>
  <SelectTrigger className="w-48"><SelectValue placeholder="Theme" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="light">Light</SelectItem>
    <SelectItem value="dark">Dark</SelectItem>
    <SelectItem value="system">System</SelectItem>
  </SelectContent>
</Select>`, ['dropdown', 'picker', 'combo']),
  shadcn('slider', 'Slider', 'Forms', 'Drag to choose a value.', ['Slider'], '<Slider defaultValue={[50]} max={100} step={1} className="w-60" />', ['range']),
  shadcn('toggle', 'Toggle', 'Actions', 'A button that stays pressed.', ['Toggle'], '<Toggle aria-label="Bold">B</Toggle>', ['pressed']),
  shadcn('tabs', 'Tabs', 'Navigation', 'Switch between panels.', ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'], `<Tabs defaultValue="account" className="w-80">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Change your account details here.</TabsContent>
  <TabsContent value="password">Change your password here.</TabsContent>
</Tabs>`, ['panels', 'segmented']),
  shadcn('accordion', 'Accordion', 'Layout', 'Sections that expand and collapse.', ['Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent'], `<Accordion type="single" collapsible className="w-80">
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>Yes. It follows the WAI-ARIA design pattern.</AccordionContent>
  </AccordionItem>
</Accordion>`, ['collapse', 'faq', 'expand']),
  shadcn('dialog', 'Dialog', 'Overlays', 'A window over the page.', ['Dialog', 'DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter'], `<Dialog>
  <DialogTrigger asChild><Button variant="outline">Edit profile</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit profile</DialogTitle>
      <DialogDescription>Make changes to your profile here.</DialogDescription>
    </DialogHeader>
    <DialogFooter><Button>Save changes</Button></DialogFooter>
  </DialogContent>
</Dialog>`, ['modal', 'popup']),
  shadcn('dropdown-menu', 'Dropdown menu', 'Overlays', 'A menu that opens from a button.', ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuItem'], `<DropdownMenu>
  <DropdownMenuTrigger asChild><Button variant="outline">Open menu</Button></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`, ['menu', 'context']),
  shadcn('tooltip', 'Tooltip', 'Overlays', 'A hint shown on hover.', ['Tooltip', 'TooltipTrigger', 'TooltipContent'], `<Tooltip>
  <TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger>
  <TooltipContent>Add to library</TooltipContent>
</Tooltip>`, ['hint', 'hover']),
  shadcn('avatar', 'Avatar', 'Display', 'A round picture with initials as fallback.', ['Avatar', 'AvatarImage', 'AvatarFallback'], `<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
  <AvatarFallback>CN</AvatarFallback>
</Avatar>`, ['profile', 'user', 'picture']),
  shadcn('progress', 'Progress', 'Feedback', 'A bar showing how far along something is.', ['Progress'], '<Progress value={60} className="w-60" />', ['loading', 'bar']),
  shadcn('skeleton', 'Skeleton', 'Feedback', 'A placeholder while content loads.', ['Skeleton'], `<div className="flex items-center gap-3">
  <Skeleton className="size-12 rounded-full" />
  <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-36" /></div>
</div>`, ['loading', 'placeholder', 'shimmer']),
  shadcn('separator', 'Separator', 'Layout', 'A thin dividing line.', ['Separator'], '<Separator className="my-4" />', ['divider', 'line', 'hr']),
];

/** Lucide icons are listed from the icon package itself; this builds their entry. */
export function lucideAsset(name: string): AssetEntry {
  return {
    id: `lucide:${name}`, library: 'lucide', name, category: 'Icons', description: `The ${name} icon from Lucide.`,
    importLine: `import { ${name} } from "lucide-react"`,
    usage: `<${name} className="size-4" />`,
  };
}

export function assetLabel(asset: AssetEntry) {
  return asset.library === 'shadcn' ? `shadcn/ui ${asset.name}` : `Lucide ${asset.name} icon`;
}

/** Case-insensitive search over name, category and keywords. */
export function searchAssets(list: AssetEntry[], query: string): AssetEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((a) => [a.name, a.category, ...(a.keywords ?? [])].some((s) => s.toLowerCase().includes(q)));
}
