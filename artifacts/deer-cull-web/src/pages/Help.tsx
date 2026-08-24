import React, { useState } from "react";
import {
  ChevronDown,
  MapPin,
  Plus,
  List,
  FileDown,
  LogIn,
  Settings,
  Pencil,
  Trash2,
  Filter,
  Search,
  CircleDot,
  CloudDownload,
  Map,
  WifiOff,
  RefreshCw,
  Wifi,
  Smartphone,
  Share2,
  MoreHorizontal,
  Timer,
  TreePine,
  Play,
  Square,
  ClipboardList,
  Camera,
  Navigation2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon, title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-card text-left hover:bg-muted/40 transition-colors"
      >
        <span className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </span>
        <span className="flex-1 font-semibold text-foreground text-sm">{title}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 bg-card border-t border-border space-y-2.5 text-sm text-muted-foreground leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <span className="flex-1 text-sm">{children}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start bg-primary/5 border border-primary/15 rounded-md px-3 py-2.5">
      <span className="text-primary font-bold shrink-0 text-[10px] mt-0.5 tracking-wider">TIP</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}

const MARKER_COLOURS = [
  { label: "Red Deer",           stag: "#8B1A1A", hind: "#C45C5C", maleLabel: "Stag", femaleLabel: "Hind" },
  { label: "Roe Deer",           stag: "#2D6A1A", hind: "#6BAF3A", maleLabel: "Buck", femaleLabel: "Doe"  },
  { label: "Fallow Deer",        stag: "#1A5C8B", hind: "#5C9FC4", maleLabel: "Buck", femaleLabel: "Doe"  },
  { label: "Sika Deer",          stag: "#6B1A8B", hind: "#A45CC4", maleLabel: "Stag", femaleLabel: "Hind" },
  { label: "Muntjac",            stag: "#8B5A1A", hind: "#C49A5C", maleLabel: "Buck", femaleLabel: "Doe"  },
  { label: "Chinese Water Deer", stag: "#1A6B6B", hind: "#5CB8B8", maleLabel: "Buck", femaleLabel: "Doe"  },
];

export default function HelpPage() {
  const { stalker } = useAuth();

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-2.5 pb-10">

        {/* Header */}
        <div className="pb-1">
          <h2 className="text-2xl font-display text-foreground">User Guide</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you need to know about Deer Cull Records
          </p>
        </div>

        {/* Signing In */}
        <Section icon={<LogIn className="w-4 h-4" />} title="Signing In" defaultOpen>
          <Step number={1}>Select your name from the list on the sign-in screen.</Step>
          <Step number={2}>Enter your 4-digit PIN using the on-screen keypad — the form signs you in automatically when all four digits are entered.</Step>
          <Step number={3}>You remain signed in until you sign out using the icon in the top header.</Step>
        </Section>

        {/* Logging a Cull */}
        <Section icon={<Plus className="w-4 h-4" />} title="Logging a Cull">
          <p className="font-semibold text-foreground text-sm">Using the Log Cull button — recommended in the field</p>
          <Step number={1}>Go to the <strong className="text-foreground">Map</strong> tab.</Step>
          <Step number={2}>Tap the green <strong className="text-foreground">Log Cull</strong> button at the bottom of the screen.</Step>
          <Step number={3}>The app acquires a live GPS fix — the button shows <em>"Getting GPS…"</em> while it does so.</Step>
          <Step number={4}>The logging form opens with your GPS coordinates and the exact time already filled in.</Step>
          <Step number={5}>Select the <strong className="text-foreground">Species</strong>, <strong className="text-foreground">Sex</strong>, and <strong className="text-foreground">Body Condition</strong>.</Step>
          <Step number={6}>Optionally enter a <strong className="text-foreground">Weight</strong> in kg. If you don't have it yet, leave it blank — you can add it later.</Step>
          <Step number={7}>For female animals (hind/doe), a <strong className="text-foreground">Pregnant</strong> toggle appears.</Step>
          <Step number={8}>Add any <strong className="text-foreground">Field Notes</strong>, then tap <strong className="text-foreground">Log Cull</strong> to save.</Step>

          <div className="pt-1" />
          <p className="font-semibold text-foreground text-sm">Tapping the map — for retroactive records</p>
          <Step number={1}>Tap anywhere on the map to drop a pin at that location.</Step>
          <Step number={2}>The form opens with those map coordinates pre-filled. Adjust date or notes as needed.</Step>
          <Tip>Grant location permission when prompted — this lets the app show your current position as a blue dot on the map.</Tip>
        </Section>

        {/* Stalking Sessions */}
        <Section icon={<Timer className="w-4 h-4" />} title="Recording Stalking Sessions">
          <p>The <strong className="text-foreground">Sessions</strong> tab tracks the time you spend in each woodland block. This produces the evidence required for <strong className="text-foreground">Countryside Stewardship Higher Tier</strong> funding — specifically the time records that demonstrate active deer management.</p>

          <p className="font-semibold text-foreground text-sm pt-2">Woodland blocks</p>
          <p>The estate is divided into twelve named blocks. You assign each session to a block so that time on the ground can be reported per area:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {[
              "Hercules","Leaselands","Jack Bells Grove","Great Wood",
              "Mount Park","Osier Carr","Pond Wood","Holly's Grove",
              "The Tollands","Marlpit Plantation","Squirrels Carr","Moorgate Carrs",
            ].map(b => (
              <div key={b} className="flex items-center gap-1.5">
                <TreePine className="w-3 h-3 text-primary shrink-0" />
                <span className="text-xs">{b}</span>
              </div>
            ))}
          </div>

          <p className="font-semibold text-foreground text-sm pt-3">Starting a live timer</p>
          <p>Use this when you are heading out now and want the app to time the session automatically.</p>
          <Step number={1}>Tap <strong className="text-foreground">Sessions</strong> in the bottom navigation, then tap <strong className="text-foreground">Log</strong>.</Step>
          <Step number={2}>Select <strong className="text-foreground">Start timer</strong>.</Step>
          <Step number={3}>Choose your <strong className="text-foreground">Woodland Block</strong> and, optionally, the weather conditions and any notes.</Step>
          <Step number={4}>Tap <strong className="text-foreground">Start Timer</strong> <Play className="w-3 h-3 inline-block mb-0.5 ml-0.5 fill-current" /> — a live banner appears at the top of the screen showing the elapsed time.</Step>
          <Step number={5}>When you leave the block, tap <strong className="text-foreground">End</strong> <Square className="w-3 h-3 inline-block mb-0.5 ml-0.5 fill-current" /> on the banner. The duration is calculated and saved automatically.</Step>
          <Tip>The timer keeps running in the background even if you switch to the Map tab to log a cull. Return to Sessions when you finish to end it.</Tip>

          <p className="font-semibold text-foreground text-sm pt-2">Entering a session retrospectively</p>
          <p>Use this when you forgot to start the timer, or to enter time spent on a previous day.</p>
          <Step number={1}>Tap <strong className="text-foreground">Log</strong>, then choose <strong className="text-foreground">Enter manually</strong>.</Step>
          <Step number={2}>Select the <strong className="text-foreground">Woodland Block</strong>, the <strong className="text-foreground">Date</strong>, and the <strong className="text-foreground">Start time</strong>.</Step>
          <Step number={3}>Enter the <strong className="text-foreground">Duration</strong> in hours and minutes.</Step>
          <Step number={4}>Add weather and notes if relevant, then tap <strong className="text-foreground">Save Session</strong>.</Step>

          <p className="font-semibold text-foreground text-sm pt-2">Viewing summaries</p>
          <p>The top of the Sessions screen shows the <strong className="text-foreground">total hours</strong> and <strong className="text-foreground">number of sessions</strong> for the selected season. When you have used more than one block, a bar chart breaks down the time per woodland block — this is the data most directly useful for Countryside Stewardship reporting.</p>
          <p>Use the season selector to switch between years. Administrators can also filter by individual stalker.</p>

          <p className="font-semibold text-foreground text-sm pt-2">Linking a cull to a woodland block</p>
          <p>When logging a cull on the Map tab, you can optionally select a <strong className="text-foreground">Woodland Block</strong> in the cull form. This records which block the animal was culled in, giving you a complete picture of activity per area for reporting.</p>

          <Tip>Try to start a timer every time you go out, even for short walks. Consistent records across the season build a much stronger evidence base for funding applications than a handful of long sessions.</Tip>
        </Section>

        {/* Impact Assessments */}
        <Section icon={<ClipboardList className="w-4 h-4" />} title="Deer Impact Assessments (WS1)">
          <p>The <strong className="text-foreground">Assess</strong> tab lets you complete a <strong className="text-foreground">WS1 Deer Habitat Impact Activity Record</strong> — the standard form required for Countryside Stewardship Higher Tier woodland management. Each record captures activity signs, impact scores, a GPS-tracked transect route, and photographic evidence.</p>

          <p className="font-semibold text-foreground text-sm pt-2">What the form covers</p>
          <p>The assessment is split into seven steps to make it manageable in the field:</p>
          <div className="space-y-1.5 pt-1">
            {[
              ["Site & Habitat", "Block, date, weather, stand type, canopy cover, ground vegetation"],
              ["GPS Transect", "Record the route you walk — distance is calculated automatically"],
              ["Deer Context", "Which species are present, which this record relates to, which is causing most damage"],
              ["Activity Signs", "Deer seen, dung tally, couches, scrapes, wallows, racks — scored N/L/M/H"],
              ["Impacts", "Bark damage, fraying, browseline, coppice browsing, sapling browsing, bramble, grazing flora"],
              ["Trends & Summary", "Overall activity and impact summary (N/L/M/H), trend direction, comments"],
              ["Photos", "Attach photos of damage or vegetation — compressed automatically"],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-2.5 items-start">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                <span><strong className="text-foreground text-xs">{title}</strong> — <span className="text-xs">{desc}</span></span>
              </div>
            ))}
          </div>

          <p className="font-semibold text-foreground text-sm pt-3">Recording a GPS transect</p>
          <div className="flex items-start gap-2.5">
            <Navigation2 className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span>On the GPS Transect step, tap <strong className="text-foreground">Start GPS Recording</strong> before you begin walking. The app records waypoints as you move and calculates the total distance walked. Tap <strong className="text-foreground">Stop</strong> when you finish the transect. GPS works without phone signal.</span>
          </div>
          <Tip>If you forget to start the GPS, you can enter the distance manually in the same step.</Tip>

          <p className="font-semibold text-foreground text-sm pt-2">Scoring guide — N / L / M / H</p>
          <p>Activity and impact indicators use a four-point scale:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {[["N", "None", "bg-muted text-muted-foreground"],["L","Low","bg-emerald-100 text-emerald-700"],["M","Moderate","bg-amber-100 text-amber-700"],["H","High","bg-red-100 text-red-700"]].map(([code, label, cls]) => (
              <div key={code} className="flex items-center gap-1.5">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", cls)}>{code}</span>
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>

          <p className="font-semibold text-foreground text-sm pt-2">Adding photos</p>
          <div className="flex items-start gap-2.5">
            <Camera className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span>On the Photos step, tap the camera area to take a new photo or choose from your gallery. Photos are compressed automatically — multiple images per assessment are supported. Add a short caption to each photo to describe what it shows.</span>
          </div>
          <Tip>Point your camera at the browseline, stripped bark, or coppice shoots. Close-up photos of impact are the most useful for supporting a funding claim.</Tip>

          <p className="font-semibold text-foreground text-sm pt-2">Exporting a PDF report</p>
          <p>Open any completed assessment and tap <strong className="text-foreground">Export PDF</strong>. The PDF reproduces the WS1 form structure with all scores, habitat notes, trends, and embedded photos. It is suitable for submission to Natural England or filing with your Countryside Stewardship claim.</p>

          <p className="font-semibold text-foreground text-sm pt-2">Working offline</p>
          <p>The assessment form — including GPS tracking and photo capture — works fully without phone signal. The GPS step uses your device's built-in satellite receiver, which does not need mobile data. Submit the assessment as normal; it will be saved to the server as soon as signal returns.</p>
        </Section>

        {/* The Map */}
        <Section icon={<MapPin className="w-4 h-4" />} title="The Map">
          <p>Each cull record appears as a coloured circle on the map. Colour indicates species and sex at a glance (see the colour guide below).</p>
          <Step number={1}><strong className="text-foreground">Tap a circle</strong> to view that record's full details.</Step>
          <Step number={2}>Use the <strong className="text-foreground">locate button</strong> (top right) to jump to your current GPS position.</Step>
          <Step number={3}>Use the <strong className="text-foreground">map type button</strong> (top right) to switch between satellite and street view.</Step>
          <Step number={4}>Use the <strong className="text-foreground">cloud download button</strong> (top right) to save map tiles for offline use — see <em>Working Without Signal</em> below.</Step>
          <Tip>Satellite view is most useful in the field for recognising woodland and terrain features.</Tip>
        </Section>

        {/* Offline Use */}
        <Section icon={<CloudDownload className="w-4 h-4" />} title="Working Without Signal">
          <p>The app is designed to work fully in areas with no phone signal. You can log culls, view the map, and browse records — everything works offline. Records are saved to your device and sync automatically the moment signal returns.</p>

          <p className="font-semibold text-foreground text-sm pt-2">Logging a cull without signal</p>
          <p>There is nothing special to do. Log a cull exactly as normal — tap <strong className="text-foreground">Log Cull</strong>, fill in the form, and tap submit. The record is saved on the device immediately.</p>
          <p>GPS works independently of phone signal, so your exact location is always captured.</p>

          <p className="font-semibold text-foreground text-sm pt-2">What you'll see while offline</p>
          <div className="flex items-start gap-2.5">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>An <strong className="text-foreground">Offline</strong> badge appears in the header so you always know your current connection state.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>Unsaved records show an <strong className="text-foreground">Unsynced</strong> badge (amber, dashed border) at the top of the Records list and as dashed-border markers on the map. They are fully visible and counted — they just haven't reached the server yet.</span>
          </div>

          <p className="font-semibold text-foreground text-sm pt-2">Syncing when signal returns</p>
          <div className="flex items-start gap-2.5">
            <Wifi className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>As soon as signal is detected the app automatically sends all queued records to the server in the background. The amber indicators disappear and the records appear in the normal list. No action is needed.</span>
          </div>
          <p>You can also tap the <strong className="text-foreground">"X unsynced"</strong> chip in the header to trigger a manual sync at any time.</p>

          <p className="font-semibold text-foreground text-sm pt-2">Downloading the map for offline use</p>
          <p>The map background (satellite and street tiles) can be saved to the device so it loads without signal. This is optional — the rest of the app works without it — but is recommended for remote beats.</p>
          <Step number={1}>On the <strong className="text-foreground">Map</strong> tab, zoom and pan to cover your full beat area.</Step>
          <Step number={2}>Tap the <strong className="text-foreground">cloud download icon</strong> (top right), review the tile count, and tap <strong className="text-foreground">Download</strong>.</Step>
          <Step number={3}>A progress bar runs while tiles are saved. Once complete, the icon turns green — the map will now load from the device with no data connection.</Step>
          <Tip>Download on Wi-Fi at the office or home before heading out. Cover a slightly larger area than you expect to work in — it only takes a minute and ensures the edges of your beat are included.</Tip>

          <p className="font-semibold text-foreground text-sm pt-2">Important — open the app before losing signal</p>
          <p>The app itself must be loaded in the browser before you enter an area with no coverage. Once the page is open and running it stays fully functional offline. The easiest way to ensure this is to <strong className="text-foreground">add the app to your phone's home screen</strong> — this keeps the app ready to open quickly and helps the browser cache the page.</p>
          <div className="flex items-start gap-2.5 pt-1">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
            <span>To free up storage, open the download panel on the Map tab and tap <strong className="text-foreground">Clear</strong>. You can re-download any time you have a connection.</span>
          </div>
        </Section>

        {/* Add to Home Screen */}
        <Section icon={<Smartphone className="w-4 h-4" />} title="Adding to Your Home Screen">
          <p>Installing the app on your phone's home screen gives you one-tap access and makes it much easier to open quickly in the field — especially before entering an area without signal.</p>

          {/* iPhone */}
          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-foreground"></span>
              </div>
              <p className="font-semibold text-foreground text-sm">iPhone (Safari)</p>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              This must be done in <strong>Safari</strong>. If you are viewing the app in Chrome or another browser on your iPhone, copy the link into Safari first.
            </p>
            <Step number={1}>
              Tap the <strong className="text-foreground">Share button</strong> at the bottom of the screen — it looks like a box with an arrow pointing upward <Share2 className="w-3.5 h-3.5 inline-block mb-0.5 ml-0.5" />.
            </Step>
            <Step number={2}>Scroll down the Share menu and tap <strong className="text-foreground">Add to Home Screen</strong>.</Step>
            <Step number={3}>The name will be pre-filled as <strong className="text-foreground">Cull Records</strong> — leave it as is or change it, then tap <strong className="text-foreground">Add</strong> in the top right.</Step>
            <Step number={4}>The stag icon appears on your home screen. Tap it to open the app in full screen without the browser toolbar.</Step>
          </div>

          {/* Android */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-foreground">▲</span>
              </div>
              <p className="font-semibold text-foreground text-sm">Android (Chrome)</p>
            </div>
            <Step number={1}>
              Tap the <strong className="text-foreground">three-dot menu</strong> in the top-right corner of Chrome <MoreHorizontal className="w-3.5 h-3.5 inline-block mb-0.5 ml-0.5" />.
            </Step>
            <Step number={2}>Tap <strong className="text-foreground">Add to Home screen</strong>. On some devices this may appear as <strong className="text-foreground">Install app</strong>.</Step>
            <Step number={3}>Confirm by tapping <strong className="text-foreground">Add</strong> or <strong className="text-foreground">Install</strong>.</Step>
            <Step number={4}>The stag icon appears on your home screen and app drawer. The app opens without browser chrome, like a native app.</Step>
          </div>

          <Tip>Once installed, always open the app from the home screen icon rather than typing the address into the browser. This ensures the app is fully loaded before you head out, so it is ready to work when you reach areas without signal.</Tip>
        </Section>

        {/* Colour Guide */}
        <Section icon={<CircleDot className="w-4 h-4" />} title="Map Marker Colour Guide">
          <p className="text-sm">Markers are colour-coded by species and sex. Darker shades indicate male animals.</p>
          <div className="space-y-2 pt-1">
            {MARKER_COLOURS.map(row => (
              <div key={row.label} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <span className="text-xs font-semibold text-foreground w-36 shrink-0">{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0"
                    style={{ backgroundColor: row.stag }}
                  />
                  <span className="text-xs text-foreground">{row.maleLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0"
                    style={{ backgroundColor: row.hind }}
                  />
                  <span className="text-xs text-foreground">{row.femaleLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Records */}
        <Section icon={<List className="w-4 h-4" />} title="Viewing Records">
          <p>Tap <strong className="text-foreground">Records</strong> in the bottom navigation to view all cull records as a list.</p>
          <div className="flex items-start gap-2 pt-1">
            <Search className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span><strong className="text-foreground">Search</strong> — type any species, sex, condition, stalker name, or note to filter instantly.</span>
          </div>
          <div className="flex items-start gap-2">
            <Filter className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span><strong className="text-foreground">Season filter</strong> — the cull season runs 1 May to 30 April. Use the dropdown to switch between years; it matches the map and cull-target year.</span>
          </div>
          <div className="flex items-start gap-2">
            <Filter className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span><strong className="text-foreground">Stalker filter</strong> — show records from one specific stalker only.</span>
          </div>
          <Step number={1}>Tap any record card to open its full detail sheet.</Step>
        </Section>

        {/* Cull Targets / Plan Year */}
        <Section icon={<Target className="w-4 h-4" />} title="Cull Targets & the Plan Year">
          <p>The <strong className="text-foreground">Cull Plan</strong> strip at the top of the Records tab tracks progress against the estate's culling targets for each species and sex (e.g. <em>roe doe — 12, red stag — 4</em>). Each target shows a progress bar, an actual / target count, and an "on target" tally for the year.</p>

          <p className="font-semibold text-foreground text-sm pt-2">The plan year — May to April</p>
          <p>Cull targets are tracked over a <strong className="text-foreground">May 1 → April 30</strong> plan year. This is the same cull season used by the map and records filters, so every view reports against the same management cycle.</p>
          <p>The label next to the Cull Plan heading shows the active plan year (for example, <em>May 2025 – Apr 2026</em>). Use the small dropdown to switch to a previous plan year.</p>
          <Tip>Plan-year progress counts <strong>every</strong> cull on the estate within the May → April window, regardless of which stalker filter is active. So filtering the records list by stalker won't make the plan look behind.</Tip>

          <p className="font-semibold text-foreground text-sm pt-2">How progress is shown</p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
              <span className="text-xs"><strong className="text-foreground">Green</strong> — target reached or exceeded.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
              <span className="text-xs"><strong className="text-foreground">Forest green bar</strong> — under target, on track.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5" />
              <span className="text-xs"><strong className="text-foreground">Red</strong> — over target (more culled than planned).</span>
            </div>
          </div>

          <p className="font-semibold text-foreground text-sm pt-2">Setting or changing targets</p>
          {stalker?.isAdmin ? (
            <>
              <p>The cull-target list is currently maintained outside the app. There isn't yet an in-app form to add or edit targets — please contact your developer to have targets added or amended for the next plan year. Each target needs:</p>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs">The <strong className="text-foreground">plan year</strong> (the May year — e.g. 2025 means May 2025 – Apr 2026)</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs">The <strong className="text-foreground">species and sex</strong> (one row per combination, e.g. red stag, red hind, roe buck, roe doe)</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs">The <strong className="text-foreground">target number</strong> to be culled in that plan year</span>
                </div>
              </div>
              <Tip>Targets carry over between plan years only if you ask for them to. By default each new May begins with whatever targets have been entered for that year — so review and re-enter before the start of every plan year.</Tip>
            </>
          ) : (
            <p>Cull targets for the estate are set by your administrator. If a target is wrong or missing for the current plan year, ask your administrator to add or update it.</p>
          )}

          <p className="font-semibold text-foreground text-sm pt-2">If no targets are set</p>
          <p>The Cull Plan strip will show <em>"No cull-plan targets set for May YYYY – Apr YYYY"</em>. You can still switch to a previous plan year using the dropdown to see historical figures.</p>
        </Section>

        {/* Editing */}
        <Section icon={<Pencil className="w-4 h-4" />} title="Editing & Deleting Records">
          <p>You can update any record — useful when adding a weight after the animal has been grallocked.</p>
          <Step number={1}>Open the record from the map (tap its marker) or the records list.</Step>
          <Step number={2}>Tap <strong className="text-foreground">Edit Record</strong> to open the editing form.</Step>
          <Step number={3}>Make your changes and tap <strong className="text-foreground">Save Changes</strong>.</Step>
          <div className="flex items-start gap-2 pt-1">
            <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
            <span>To <strong className="text-foreground">delete</strong> a record, tap the bin icon in the detail sheet. A confirmation step prevents accidental deletion.</span>
          </div>
        </Section>

        {/* Export */}
        <Section icon={<FileDown className="w-4 h-4" />} title="Exporting Reports & Maps">
          <p>The <strong className="text-foreground">Export</strong> button on the Records tab offers two formats. Set your season and stalker filters first — the export always reflects your current view.</p>

          <div className="flex items-start gap-2.5 pt-1">
            <FileDown className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="font-semibold text-foreground text-sm">PDF Report</p>
              <p>A formatted document with a summary table (total culls, weight, pregnancy count, species breakdown) followed by all individual records. Suitable for filing, emailing, or printing.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Map className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="font-semibold text-foreground text-sm">Interactive Map (HTML file)</p>
              <p>A self-contained HTML file that opens in any browser — no internet required after download. It includes colour-coded markers with clickable popups, a heatmap toggle to show activity density, a satellite/street layer switch, a stats sidebar, and a species colour key.</p>
            </div>
          </div>

          <p className="font-semibold text-foreground text-sm pt-1">Steps</p>
          <Step number={1}>Go to the <strong className="text-foreground">Records</strong> tab.</Step>
          <Step number={2}>Set the season and stalker filters as needed.</Step>
          <Step number={3}>Tap <strong className="text-foreground">Export</strong> and choose <strong className="text-foreground">PDF Report</strong> or <strong className="text-foreground">Interactive Map</strong>.</Step>
          <Step number={4}>The file downloads automatically and can be shared or archived.</Step>
          <Tip>The interactive map file can be emailed as a single attachment and opened directly on any device — no app or internet connection needed.</Tip>
        </Section>

        {/* Admin — only shown to admins */}
        {stalker?.isAdmin && (
          <Section icon={<Settings className="w-4 h-4" />} title="Admin: Managing Stalker Accounts">
            <p>As an administrator, you manage accounts via <strong className="text-foreground">Admin</strong> in the header.</p>
            <Step number={1}>Tap <strong className="text-foreground">Admin</strong> in the header to open the admin panel.</Step>
            <Step number={2}>Tap <strong className="text-foreground">Add Stalker</strong> to create a new account — enter their name, a 4-digit PIN, and their role.</Step>
            <Step number={3}>To change a name or PIN, tap the <strong className="text-foreground">edit icon</strong> next to their name.</Step>
            <Step number={4}>To remove a stalker, tap the <strong className="text-foreground">delete icon</strong>. Their cull records are kept but will no longer be attributed.</Step>
            <Tip>Share the app URL with each stalker so they can add it to their phone's home screen for quick field access.</Tip>
          </Section>
        )}

        {!stalker?.isAdmin && (
          <Section icon={<Settings className="w-4 h-4" />} title="Admin Functions">
            <p>Your estate administrator manages stalker accounts, including adding new users and resetting PINs. Contact them if you need any account changes.</p>
          </Section>
        )}

        <p className="text-center text-xs text-muted-foreground pt-3">
          Deer Cull Records — Estate Management System
        </p>
      </div>
    </div>
  );
}
