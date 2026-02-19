import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TextShape, updateShape } from "@/redux/slices/shapes";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { Slider } from "@/components/ui/slider";
import React, { useState, useEffect } from "react";
import { Toggle } from "@/components/ui/toggle";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Palette,
  Strikethrough,
  Underline,
  Type,
  Space,
  LineChart,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  isOpen: boolean;
};

/**
 * TextSidebar Component
 *
 * Comprehensive text editing sidebar for TextShape objects
 * Provides controls for typography, styling, and alignment
 */
const TextSidebar = ({ isOpen }: Props) => {
  // ========================================================================
  // REDUX STATE
  // ========================================================================

  const dispatch = useAppDispatch();
  const selectedShapes = useAppSelector((state) => state.shapes.selected);
  const shapesEntities = useAppSelector(
    (state) => state.shapes.shapes.entities,
  );

  // Find the first selected text shape
  const selectedTextShape = Object.keys(selectedShapes)
    .map((id) => shapesEntities[id])
    .find((shape) => shape?.type === "text") as TextShape | undefined;

  // ========================================================================
  // LOCAL STATE
  // ========================================================================

  const [colorInput, setColorInput] = useState(
    selectedTextShape?.fill || "#ffffff",
  );

  // Update color input when selection changes
  useEffect(() => {
    if (selectedTextShape) {
      setColorInput(selectedTextShape.fill || "#ffffff");
    }
  }, [selectedTextShape?.id]); //eslint-disable-line react-hooks/exhaustive-deps

  // ========================================================================
  // FONT FAMILIES
  // ========================================================================

  const fontFamilies = [
    "Arial, sans-serif",
    "Verdana, sans-serif",
    "Times New Roman, serif",
    "Georgia, serif",
    "Courier New, monospace",
    "Trebuchet MS, sans-serif",
    "Comic Sans MS, cursive",
    "Impact, sans-serif",
    "Arial Black, sans-serif",
    "Palatino Linotype, Book Antiqua, Palatino, serif",
    "Lucida Sans Unicode, Lucida Grande, sans-serif",
    "Tahoma, Geneva, sans-serif",
    "Geneva, Verdana, sans-serif",
    "Helvetica, Arial, sans-serif",
    "Monaco, Courier, monospace",
    "BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
  ];

  // ========================================================================
  // UPDATE FUNCTIONS
  // ========================================================================

  /**
   * Update a text shape property
   */
  const updateTextProperty = (property: keyof TextShape, value: any) => {
    if (!selectedTextShape) return;

    dispatch(
      updateShape({
        id: selectedTextShape.id,
        patch: { [property]: value },
      }),
    );
  };

  /**
   * Handle text color change with validation
   */
  const handleColorChange = (color: string) => {
    setColorInput(color);

    // Only update if valid hex color
    if (/^#[0-9a-fA-F]{6}$/.test(color) || /^#[0-9a-fA-F]{3}$/.test(color)) {
      updateTextProperty("fill", color);
    }
  };

  /**
   * Open native color picker
   */
  const openColorPicker = () => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = selectedTextShape?.fill || "#ffffff";
    input.onchange = (e) => {
      const color = (e.target as HTMLInputElement).value;
      setColorInput(color);
      updateTextProperty("fill", color);
    };
    input.click();
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!isOpen || !selectedTextShape) return null;

  return (
    <div
      className={cn(
        "fixed right-5 top-1/2 transform -translate-y-1/2 w-80 backdrop-blur-xl bg-white/8 border-white/12 gap-2 p-3 saturate-150 border rounded-lg z-50 transition-transform duration-300",
        "translate-x-0",
      )}
    >
      <div className="p-4 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
        {/* ================================================================ */}
        {/* FONT FAMILY */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <Label className="text-white/80 flex items-center gap-2">
            <Type className="w-4 h-4" />
            Font Family
          </Label>
          <Select
            value={selectedTextShape.fontFamily}
            onValueChange={(value) => updateTextProperty("fontFamily", value)}
          >
            <SelectTrigger className="bg-white/5 border-white/10 w-full text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/90">
              {fontFamilies.map((font) => (
                <SelectItem
                  key={font}
                  value={font}
                  className="text-white hover:bg-white/10"
                >
                  <span style={{ fontFamily: font }}>{font.split(",")[0]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ================================================================ */}
        {/* FONT SIZE */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white/80">Font Size</Label>
            <span className="text-white/60 text-sm">
              {selectedTextShape.fontSize}px
            </span>
          </div>
          <Slider
            value={[selectedTextShape.fontSize]}
            onValueChange={(values) =>
              updateTextProperty("fontSize", values[0])
            }
            min={8}
            max={120}
            step={1}
            className="w-full"
          />
        </div>

        {/* ================================================================ */}
        {/* FONT WEIGHT */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <Label className="text-white/80">Font Weight</Label>
          <Select
            value={String(selectedTextShape.fontWeight)}
            onValueChange={(value) =>
              updateTextProperty("fontWeight", parseInt(value))
            }
          >
            <SelectTrigger className="bg-white/5 border-white/10 w-full text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/90">
              <SelectItem value="100" className="text-white hover:bg-white/10">
                Thin (100)
              </SelectItem>
              <SelectItem value="200" className="text-white hover:bg-white/10">
                Extra Light (200)
              </SelectItem>
              <SelectItem value="300" className="text-white hover:bg-white/10">
                Light (300)
              </SelectItem>
              <SelectItem value="400" className="text-white hover:bg-white/10">
                Normal (400)
              </SelectItem>
              <SelectItem value="500" className="text-white hover:bg-white/10">
                Medium (500)
              </SelectItem>
              <SelectItem value="600" className="text-white hover:bg-white/10">
                Semi Bold (600)
              </SelectItem>
              <SelectItem value="700" className="text-white hover:bg-white/10">
                Bold (700)
              </SelectItem>
              <SelectItem value="800" className="text-white hover:bg-white/10">
                Extra Bold (800)
              </SelectItem>
              <SelectItem value="900" className="text-white hover:bg-white/10">
                Black (900)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ================================================================ */}
        {/* TEXT STYLING */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <Label className="text-white/80">Text Style</Label>
          <div className="flex gap-2">
            {/* Bold Toggle */}
            <Toggle
              pressed={selectedTextShape.fontWeight >= 700}
              onPressedChange={(pressed) =>
                updateTextProperty("fontWeight", pressed ? 700 : 400)
              }
              aria-label="Toggle bold"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <Bold className="h-4 w-4 text-white" />
            </Toggle>

            {/* Italic Toggle */}
            <Toggle
              pressed={selectedTextShape.fontStyle === "italic"}
              onPressedChange={(pressed) =>
                updateTextProperty("fontStyle", pressed ? "italic" : "normal")
              }
              aria-label="Toggle italic"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <Italic className="h-4 w-4 text-white" />
            </Toggle>

            {/* Underline Toggle */}
            <Toggle
              pressed={selectedTextShape.textDecoration === "underline"}
              onPressedChange={(pressed) =>
                updateTextProperty(
                  "textDecoration",
                  pressed ? "underline" : "none",
                )
              }
              aria-label="Toggle underline"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <Underline className="h-4 w-4 text-white" />
            </Toggle>

            {/* Strikethrough Toggle */}
            <Toggle
              pressed={selectedTextShape.textDecoration === "line-through"}
              onPressedChange={(pressed) =>
                updateTextProperty(
                  "textDecoration",
                  pressed ? "line-through" : "none",
                )
              }
              aria-label="Toggle strikethrough"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <Strikethrough className="h-4 w-4 text-white" />
            </Toggle>
          </div>
        </div>

        {/* ================================================================ */}
        {/* TEXT ALIGNMENT */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <Label className="text-white/80">Text Alignment</Label>
          <div className="flex gap-2">
            {/* Left Align */}
            <Toggle
              pressed={selectedTextShape.textAlign === "left"}
              onPressedChange={() => updateTextProperty("textAlign", "left")}
              aria-label="Align left"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <AlignLeft className="h-4 w-4 text-white" />
            </Toggle>

            {/* Center Align */}
            <Toggle
              pressed={selectedTextShape.textAlign === "center"}
              onPressedChange={() => updateTextProperty("textAlign", "center")}
              aria-label="Align center"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <AlignCenter className="h-4 w-4 text-white" />
            </Toggle>

            {/* Right Align */}
            <Toggle
              pressed={selectedTextShape.textAlign === "right"}
              onPressedChange={() => updateTextProperty("textAlign", "right")}
              aria-label="Align right"
              className="bg-white/5 border-white/10 hover:bg-white/10 data-[state=on]:bg-white/20"
            >
              <AlignRight className="h-4 w-4 text-white" />
            </Toggle>
          </div>
        </div>

        {/* ================================================================ */}
        {/* TEXT COLOR */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <Label className="text-white/80 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Text Color
          </Label>
          <div className="flex gap-2">
            <Input
              value={colorInput}
              onChange={(e) => handleColorChange(e.target.value)}
              placeholder="#ffffff"
              className="bg-white/5 border-white/10 text-white"
            />
            <div
              className="w-10 h-10 rounded border border-white/20 cursor-pointer flex-shrink-0 hover:border-white/40 transition-colors"
              style={{ backgroundColor: selectedTextShape.fill || "#ffff" }}
              onClick={openColorPicker}
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* LINE HEIGHT */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white/80 flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              Line Height
            </Label>
            <span className="text-white/60 text-sm">
              {selectedTextShape.lineHeight.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[selectedTextShape.lineHeight]}
            onValueChange={(values) =>
              updateTextProperty("lineHeight", values[0])
            }
            min={0.5}
            max={3}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* ================================================================ */}
        {/* LETTER SPACING */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white/80 flex items-center gap-2">
              <Space className="w-4 h-4" />
              Letter Spacing
            </Label>
            <span className="text-white/60 text-sm">
              {selectedTextShape.letterSpacing.toFixed(1)}px
            </span>
          </div>
          <Slider
            value={[selectedTextShape.letterSpacing]}
            onValueChange={(values) =>
              updateTextProperty("letterSpacing", values[0])
            }
            min={-5}
            max={20}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* ================================================================ */}
        {/* TEXT TRANSFORM */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <Label className="text-white/80">Text Transform</Label>
          <Select
            value={selectedTextShape.textTransform}
            onValueChange={(value) =>
              updateTextProperty(
                "textTransform",
                value as TextShape["textTransform"],
              )
            }
          >
            <SelectTrigger className="bg-white/5 border-white/10 w-full text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/90">
              <SelectItem value="none" className="text-white hover:bg-white/10">
                None
              </SelectItem>
              <SelectItem
                value="uppercase"
                className="text-white hover:bg-white/10"
              >
                UPPERCASE
              </SelectItem>
              <SelectItem
                value="lowercase"
                className="text-white hover:bg-white/10"
              >
                lowercase
              </SelectItem>
              <SelectItem
                value="capitalize"
                className="text-white hover:bg-white/10"
              >
                Capitalize
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ================================================================ */}
        {/* OPACITY (if in BaseShape) */}
        {/* ================================================================ */}
        {(selectedTextShape as any).opacity !== undefined && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white/80">Opacity</Label>
              <span className="text-white/60 text-sm">
                {Math.round(((selectedTextShape as any).opacity || 1) * 100)}%
              </span>
            </div>
            <Slider
              value={[((selectedTextShape as any).opacity || 1) * 100]}
              onValueChange={(values) =>
                updateTextProperty("opacity" as any, values[0] / 100)
              }
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TextSidebar;
