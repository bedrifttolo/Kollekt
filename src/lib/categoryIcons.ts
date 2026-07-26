import {
  BrushCleaning,
  Cake,
  ChefHat,
  CircleCheckBig,
  Clapperboard,
  ClipboardList,
  Dices,
  DoorOpen,
  Droplets,
  Feather,
  Flower2,
  Grid2x2,
  Luggage,
  MapPin,
  PartyPopper,
  ShoppingCart,
  ShowerHead,
  Sofa,
  Sparkles,
  Toilet,
  Trash2,
  Trophy,
  UtensilsCrossed,
  WashingMachine,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { EventType, TaskCategory } from './types';

export const TASK_CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  CLEANING: Sparkles,
  SMALL_CLEANING: BrushCleaning,
  VACUUMING: Wind,
  MOPPING: Droplets,
  BATHROOM: ShowerHead,
  KITCHEN: ChefHat,
  LAUNDRY: WashingMachine,
  DISHES: UtensilsCrossed,
  TRASH: Trash2,
  DUSTING: Feather,
  WINDOWS: Grid2x2,
  SHOPPING: ShoppingCart,
  OTHER: CircleCheckBig,
};

export const EVENT_TYPE_ICONS: Record<EventType, LucideIcon> = {
  PARTY: PartyPopper,
  MOVIE: Clapperboard,
  DINNER: UtensilsCrossed,
  GAME_NIGHT: Dices,
  CLEANING: Sparkles,
  SPORTS: Trophy,
  BIRTHDAY: Cake,
  MEETING: ClipboardList,
  TRIP: Luggage,
  OTHER: MapPin,
};

export const ROOM_TYPE_ICONS: Record<string, LucideIcon> = {
  kitchen: ChefHat,
  bathroom: ShowerHead,
  livingRoom: Sofa,
  toilet: Toilet,
  hallway: DoorOpen,
  laundry: WashingMachine,
  diningRoom: UtensilsCrossed,
  balcony: Flower2,
  stairs: Sparkles,
};

export const DEFAULT_ROOM_ICON = Sparkles;
