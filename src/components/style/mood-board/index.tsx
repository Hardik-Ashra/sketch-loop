import { MoodboardImage, useMoodBoard } from "@/hooks/use-styles";

type Props = {
  guideImages: MoodboardImage[];
};

const MoodBoard = ({ guideImages }: Props) => {
  const {
    images,
    dragActive,
    removeImage,
    handleDrag,
    handleDrop,
    handleFileInput,
    canAddMore,
  } = useMoodBoard(guideImages);
  return (
    //TODO: wire up dragactive and handle events
    <div className="flex flex-col gap-10">
      <div
        className="relative border-2 border-dashed rounded-3xl p-12
text-center transition-all duration-200 min-h-[500px] flex items-center
justify-center "
      ></div>

      <div className="absolute inset-0 opacity-5">
        <div
          className="w-full h-full bg-linear-to-br from-primary/20
to-transparent rounded-3x1"
        />
      </div>
    </div>
  );
};

export default MoodBoard;
