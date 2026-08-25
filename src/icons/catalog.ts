import type { ComponentType, SVGProps } from 'react';

import ArchivePencilDuo from './archive-pencil';
import BellDuo from './bell';
import BoxDuo from './box';
import BugDuo from './bug';
import CalendarDaysDuo from './calendar-days';
import ChartUpDuo from './chart-up';
import ChatDuo from './chat';
import ChevronLeftDuo from './chevron-left';
import ChevronUpDuo from './chevron-up';
import CirclePlusDuo from './circle-plus';
import DotsOutline from './dots';
import EditDuo from './edit';
import FilterDuo from './filter';
import FolderDuo from './folder';
import GearDuo from './gear';
import GridDotsDuo from './grid-dots';
import HomeDuo from './home';
import HourglassStartDuo from './hourglass-start';
import ImprovementsDuo from './improvements';
import InterviewDuo from './interview';
import LightbulbDuo from './lightbulb';
import LoaderQuarterDuo from './loader-quarter';
import MegaphoneDuo from './megaphone';
import { AddMagicOutline18 } from './nucleo/AddMagicOutline18';
import { ArchivePencilOutline18 } from './nucleo/ArchivePencilOutline18';
import { BellOutline18 } from './nucleo/BellOutline18';
import { Box2Outline18 } from './nucleo/Box2Outline18';
import { BugOutline18 } from './nucleo/BugOutline18';
import { BullhornOutline18 } from './nucleo/BullhornOutline18';
import { CalendarDaysOutline18 } from './nucleo/CalendarDaysOutline18';
import { ChartTrendUpOutline18 } from './nucleo/ChartTrendUpOutline18';
import { ChevronLeftOutline18 } from './nucleo/ChevronLeftOutline18';
import { CircleOpenArrowUpOutline18 } from './nucleo/CircleOpenArrowUpOutline18';
import { CirclePlusOutline18 } from './nucleo/CirclePlusOutline18';
import { DotsGlyphDuo18 } from './nucleo/DotsGlyphDuo18';
import { EyeGlyphDuo18 } from './nucleo/EyeGlyphDuo18';
import { EyeOutline18 } from './nucleo/EyeOutline18';
import { Filter2Outline18 } from './nucleo/Filter2Outline18';
import { Folder5OpenOutline18 } from './nucleo/Folder5OpenOutline18';
import { GearOutline18 } from './nucleo/GearOutline18';
import { GridDotsOutline18 } from './nucleo/GridDotsOutline18';
import { GridEmptyObjBottomLeftGlyphDuo18 } from './nucleo/GridEmptyObjBottomLeftGlyphDuo18';
import { GridEmptyObjBottomLeftOutline18 } from './nucleo/GridEmptyObjBottomLeftOutline18';
import { HourglassStartOutline18 } from './nucleo/HourglassStartOutline18';
import { House4Outline18 } from './nucleo/House4Outline18';
import { InterviewOutline18 } from './nucleo/InterviewOutline18';
import { Lightbulb2Outline18 } from './nucleo/Lightbulb2Outline18';
import { Loader6Outline18 } from './nucleo/Loader6Outline18';
import { MagnifierSparkle2GlyphDuo18 } from './nucleo/MagnifierSparkle2GlyphDuo18';
import { MagnifierSparkle2Outline18 } from './nucleo/MagnifierSparkle2Outline18';
import { MsgsOutline18 } from './nucleo/MsgsOutline18';
import { Pen2GlyphDuo18 } from './nucleo/Pen2GlyphDuo18';
import { Pen2Outline18 } from './nucleo/Pen2Outline18';
import { PenOutline18 } from './nucleo/PenOutline18';
import { Roadmap2Outline18 } from './nucleo/Roadmap2Outline18';
import { SettingsWrenchOutline18 } from './nucleo/SettingsWrenchOutline18';
import { Sliders2Outline18 } from './nucleo/Sliders2Outline18';
import { VShapedArrowRightGlyphDuo18 } from './nucleo/VShapedArrowRightGlyphDuo18';
import { VShapedArrowRightOutline18 } from './nucleo/VShapedArrowRightOutline18';
import { VShapedArrowUpOutline18 } from './nucleo/VShapedArrowUpOutline18';
import RoadmapDuo from './roadmap';
import SettingsSlidersDuo from './settings-sliders';
import SparkleDuo from './sparkle';
import UpArrowCircleDuo from './up-arrow-circle';

export type NucleoIconVariant = 'glyph-duo' | 'outline';

export type NucleoIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type NucleoIconPair = Record<NucleoIconVariant, NucleoIconComponent>;

/**
 * The app-wide semantic Nucleo catalog. Product code uses Nucleo's canonical
 * `glyph-duo` and `outline` variant names;
 * Nucleo's package-level fill names stay encapsulated in this module.
 */
export const nucleoIconCatalog = {
	archivePencil: { 'glyph-duo': ArchivePencilDuo, outline: ArchivePencilOutline18 },
	bell: { 'glyph-duo': BellDuo, outline: BellOutline18 },
	box: { 'glyph-duo': BoxDuo, outline: Box2Outline18 },
	bug: { 'glyph-duo': BugDuo, outline: BugOutline18 },
	calendarDays: { 'glyph-duo': CalendarDaysDuo, outline: CalendarDaysOutline18 },
	chartUp: { 'glyph-duo': ChartUpDuo, outline: ChartTrendUpOutline18 },
	chat: { 'glyph-duo': ChatDuo, outline: MsgsOutline18 },
	chevronLeft: { 'glyph-duo': ChevronLeftDuo, outline: ChevronLeftOutline18 },
	chevronUp: { 'glyph-duo': ChevronUpDuo, outline: VShapedArrowUpOutline18 },
	circlePlus: { 'glyph-duo': CirclePlusDuo, outline: CirclePlusOutline18 },
	dots: { 'glyph-duo': DotsGlyphDuo18, outline: DotsOutline },
	edit: { 'glyph-duo': EditDuo, outline: PenOutline18 },
	eye: { 'glyph-duo': EyeGlyphDuo18, outline: EyeOutline18 },
	filter: { 'glyph-duo': FilterDuo, outline: Filter2Outline18 },
	folder: { 'glyph-duo': FolderDuo, outline: Folder5OpenOutline18 },
	gear: { 'glyph-duo': GearDuo, outline: GearOutline18 },
	gridDots: { 'glyph-duo': GridDotsDuo, outline: GridDotsOutline18 },
	home: { 'glyph-duo': HomeDuo, outline: House4Outline18 },
	hourglassStart: { 'glyph-duo': HourglassStartDuo, outline: HourglassStartOutline18 },
	improvements: { 'glyph-duo': ImprovementsDuo, outline: SettingsWrenchOutline18 },
	interview: { 'glyph-duo': InterviewDuo, outline: InterviewOutline18 },
	lightbulb: { 'glyph-duo': LightbulbDuo, outline: Lightbulb2Outline18 },
	loaderQuarter: { 'glyph-duo': LoaderQuarterDuo, outline: Loader6Outline18 },
	megaphone: { 'glyph-duo': MegaphoneDuo, outline: BullhornOutline18 },
	missing: {
		'glyph-duo': GridEmptyObjBottomLeftGlyphDuo18,
		outline: GridEmptyObjBottomLeftOutline18,
	},
	pen: { 'glyph-duo': Pen2GlyphDuo18, outline: Pen2Outline18 },
	roadmap: { 'glyph-duo': RoadmapDuo, outline: Roadmap2Outline18 },
	searchSparkle: {
		'glyph-duo': MagnifierSparkle2GlyphDuo18,
		outline: MagnifierSparkle2Outline18,
	},
	settingsSliders: { 'glyph-duo': SettingsSlidersDuo, outline: Sliders2Outline18 },
	sparkle: { 'glyph-duo': SparkleDuo, outline: AddMagicOutline18 },
	upArrowCircle: {
		'glyph-duo': UpArrowCircleDuo,
		outline: CircleOpenArrowUpOutline18,
	},
	vArrowRight: {
		'glyph-duo': VShapedArrowRightGlyphDuo18,
		outline: VShapedArrowRightOutline18,
	},
} as const satisfies Record<string, NucleoIconPair>;

export type NucleoIconName = keyof typeof nucleoIconCatalog;
