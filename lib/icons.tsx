import {
  IconAlarm, IconApple, IconArchive, IconBattery, IconBattery1, IconBattery2, IconBattery3, IconBattery4, IconBatteryCharging, IconBed, IconBook, IconBook2, IconBookmark,
  IconBriefcase, IconBulb, IconBus, IconCalendar, IconCalendarEvent, IconCamera, IconChartPie, IconChefHat, IconCheck, IconClock, IconCoffee, IconCookie, IconCurrencyReal,
  IconDeviceGamepad2, IconDeviceTv, IconDroplet, IconDumbbell, IconFlame, IconFlag, IconFlower, IconGift, IconGlassFull, IconHeart, IconHeartHandshake, IconHome, IconHourglass,
  IconLeaf, IconLink, IconLuggage, IconMapPin, IconMountain, IconMovie, IconMoodCry, IconMoodHappy, IconMoodNeutral, IconMoodSad, IconMoodSmile, IconMoon, IconMusic, IconNews,
  IconNotebook, IconPalette, IconPencil, IconPhoto, IconPlane, IconPlant, IconReceipt, IconRun, IconSalad, IconScale, IconSettings, IconShoppingCart, IconSoup, IconSparkles, IconStar,
  IconSun, IconSunrise, IconTarget, IconToolsKitchen2, IconTrophy, IconWallet, IconWalk, IconYoga, IconBrain, IconHeadphones, IconMicrophone, IconBike, IconShirt, IconPizza,
  IconCar, IconTrain, IconTent, IconCompass, IconBrush, IconCheckbox, IconListCheck, IconWriting, IconRobot, IconRss, IconSearch, IconBell, IconSend, IconPlus, IconTrash, IconEdit, IconDots, IconX,
  IconChevronRight, IconChevronLeft, IconArrowLeft, IconArrowRight, IconDownload, IconUpload, IconLock, IconRefresh, IconPlayerPlay, IconPlayerSkipBack, IconPlayerSkipForward,
  IconExternalLink, IconFilter, IconUser, IconLogout, IconMoodSmileBeam, IconSquareCheck, IconShoppingBag, IconStarFilled, IconBookmarkFilled, IconSunHigh, IconSunset, IconNotes,
  IconMug, IconWand, IconEye, IconEyeOff, IconDeviceMobile, IconLayoutGrid, IconChartLine, IconTargetArrow, IconHome2, IconMoodWink, IconStars, IconMoodSpark,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

type IconCmp = ComponentType<{ size?: number | string; stroke?: number; color?: string; className?: string }>;

/** Ícones por nome: dá para guardar o nome no banco e usar em server e client components. */
export const ICONS: Record<string, IconCmp> = {
  sun: IconSun, moon: IconMoon, sunrise: IconSunrise, sunset: IconSunset, sunhigh: IconSunHigh, briefcase: IconBriefcase, book: IconBook, book2: IconBook2, bookmark: IconBookmark, "bookmark-filled": IconBookmarkFilled,
  pencil: IconPencil, edit: IconEdit, palette: IconPalette, brush: IconBrush, plane: IconPlane, luggage: IconLuggage, heart: IconHeart, handshake: IconHeartHandshake, wallet: IconWallet, real: IconCurrencyReal,
  settings: IconSettings, check: IconCheck, checkbox: IconCheckbox, "square-check": IconSquareCheck, plus: IconPlus, trash: IconTrash, x: IconX, dots: IconDots, droplet: IconDroplet, glass: IconGlassFull, run: IconRun, walk: IconWalk,
  yoga: IconYoga, dumbbell: IconDumbbell, bike: IconBike, apple: IconApple, salad: IconSalad, soup: IconSoup, kitchen: IconToolsKitchen2, chef: IconChefHat, music: IconMusic, headphones: IconHeadphones, mic: IconMicrophone,
  camera: IconCamera, photo: IconPhoto, link: IconLink, bulb: IconBulb, calendar: IconCalendar, event: IconCalendarEvent, clock: IconClock, hourglass: IconHourglass, flame: IconFlame, trophy: IconTrophy, star: IconStar,
  "star-filled": IconStarFilled, leaf: IconLeaf, plant: IconPlant, flower: IconFlower, brain: IconBrain, robot: IconRobot, send: IconSend, search: IconSearch, bell: IconBell, rss: IconRss, news: IconNews, gift: IconGift,
  cart: IconShoppingCart, bag: IconShoppingBag, mountain: IconMountain, pin: IconMapPin, compass: IconCompass, pizza: IconPizza, bus: IconBus, home: IconHome, home2: IconHome2, receipt: IconReceipt, coffee: IconCoffee, mug: IconMug,
  gamepad: IconDeviceGamepad2, tv: IconDeviceTv, movie: IconMovie, scale: IconScale, shirt: IconShirt, download: IconDownload, upload: IconUpload, chart: IconChartPie, line: IconChartLine, target: IconTarget,
  "target-arrow": IconTargetArrow, sparkles: IconSparkles, stars: IconStars, wand: IconWand, lock: IconLock, refresh: IconRefresh, play: IconPlayerPlay, prev: IconPlayerSkipBack, next: IconPlayerSkipForward,
  external: IconExternalLink, filter: IconFilter, user: IconUser, logout: IconLogout, alarm: IconAlarm, bed: IconBed, notebook: IconNotebook, writing: IconWriting, notes: IconNotes, list: IconListCheck, tent: IconTent,
  car: IconCar, train: IconTrain, cookie: IconCookie, archive: IconArrowRight, flag: IconFlag, eye: IconEye, "eye-off": IconEyeOff, mobile: IconDeviceMobile, grid: IconLayoutGrid, back: IconArrowLeft, right: IconChevronRight, left: IconChevronLeft,
  "mood-1": IconMoodCry, "mood-2": IconMoodSad, "mood-3": IconMoodNeutral, "mood-4": IconMoodSmile, "mood-5": IconMoodHappy, "mood-wink": IconMoodWink, "mood-beam": IconMoodSmileBeam, "mood-spark": IconMoodSpark,
  "battery-1": IconBattery1, "battery-2": IconBattery2, "battery-3": IconBattery3, "battery-4": IconBattery4, "battery-5": IconBatteryCharging, battery: IconBattery, robot2: IconRobot,
};
void IconArchive;

export function Icon({ name, size = 20, stroke = 1.8, color, className }: { name: string; size?: number; stroke?: number; color?: string; className?: string }) {
  const C = ICONS[name] ?? ICONS.sparkles;
  return <C size={size} stroke={stroke} color={color} className={className} />;
}
