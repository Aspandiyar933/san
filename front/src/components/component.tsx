import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Component() {
  const [inputText, setInputText] = useState('');
  const [, setSelectedVideo] = useState('');
  const [selectedVideoG, setSelectedVideoG] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setGenerationProgress] = useState(0);

  const videos = [
    'PythagoreanTheorem.mp4',
    'ContinuousMotion.mp4',
    'CircleToSquare.mp4',
    'FibonacciSequence.mp4',
    'TrigonometryInCircle.mp4',
    'HyperbolaIllustration.mp4',
    'EulersIdentityAnimated.mp4',
    'AreaOfShapes.mp4',
    'FractalTree.mp4'
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    const interval = setInterval(() => {
      setGenerationProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setSelectedVideoG('');
          return 100;
        }
        return prevProgress + 10;
      });
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 bg-gray-50">
      <header className="flex justify-between w-full p-4 border-b bg-white">
        <div className="text-lg font-bold">AniMath</div>
      </header>
      <main className="flex flex-col items-center w-full flex-1 p-4">
        <h1 className="text-2xl font-bold text-center mb-4">Animate math, and explore it like a 3b1b</h1>
        <div className="flex flex-col items-center w-full max-w-lg space-y-4">
          <Input
            type="text"
            placeholder="Enter request for creating Manim animation"
            className="w-full"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="flex flex-col gap-4 w-full">
            <Button className="flex-1" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? `Generating...` : 'Generate'}
            </Button>
            <div className="flex gap-4 w-full">
              <Button variant="outline" className="flex-1">Animate Equations</Button>
              <Button variant="outline" className="flex-1">Visualize Concepts</Button>
              <Button variant="outline" className="flex-1">Explain Theorems</Button>
            </div>
          </div>
        </div>
        <div className="w-full max-w-lg mt-8 bg-white border rounded-lg shadow-md overflow-hidden">
          <div className="aspect-w-16 aspect-h-9">
            <video
              src={selectedVideoG} 
              className="object-cover w-full h-full"
              controls
            >
              
            </video>
          </div>
        </div>
        <div className="w-full mt-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Top Generated Videos</h2>
          <div className="grid grid-cols-3 gap-4">
            {videos.map((video, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105 cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="aspect-w-16 aspect-h-9">
                  <video
                    src={video}
                    className="object-cover w-full h-full"
                    controls
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="p-2">
                  <h3 className="font-semibold text-gray-700 text-sm">
                    {video.replace('.mp4', '')}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Math visualization</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}