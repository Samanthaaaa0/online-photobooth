import layout4 from "../assets/layout4.png";
import layout6 from "../assets/layout6.png";
// import layoutMeme from "../assets/layoutmeme.png";

import "../LayoutSelection.css";

type LayoutType = "4-cuts" | "6-cuts" | "meme";

type LayoutSelectionProps = {
  onSelectLayout: (layout: LayoutType) => void;
};

function LayoutSelection({
  onSelectLayout,
}: LayoutSelectionProps) {

  const layouts = [
    {
      id: "4-cuts" as LayoutType,
      title: "4 CUTS",
      description: "Classic photobooth",
      image: layout4,
    },
    {
      id: "6-cuts" as LayoutType,
      title: "6 CUTS",
      description: "Extra poses",
      image: layout6,
    },
    {
      id: "meme" as LayoutType,
      title: "MEME MODE",
      description: "3 pics · 6 cuts",
      // image: layoutMeme,
    },
  ];

  return (
    <div className="layout-selection">

      <div className="layout-window">

        {/* WINDOW HEADER */}

        <div className="layout-window-header">
          <span>✦ PHOTOBOOTH.EXE</span>

          <div className="window-buttons">
            <span>_</span>
            <span>□</span>
            <span>×</span>
          </div>
        </div>


        {/* CONTENT */}

        <div className="layout-content">

          <h1>CHOOSE YOUR PHOTO STYLE ♡</h1>

          <p className="layout-subtitle">
            SELECT A TEMPLATE TO CONTINUE
          </p>


          <div className="layout-options">

            {layouts.map((layout) => (

              <button
                key={layout.id}
                onClick={() => onSelectLayout(layout.id)}
                className="layout-card"
              >

                <div className="layout-image">
                  {layout.image && (
                    <img
                      src={layout.image}
                      alt={layout.title}
                    />
                  )}
                </div>

                <div className="layout-card-info">

                  <h2>{layout.title}</h2>

                  <p>{layout.description}</p>

                </div>

                <div className="select-button">
                  SELECT
                </div>

              </button>

            ))}

          </div>

        </div>


        {/* STATUS BAR */}

        <div className="layout-status">

          <span>● READY</span>

          <span>PHOTOBOOTH.EXE</span>

          <span>v1.0</span>

        </div>

      </div>

    </div>
  );
}

export default LayoutSelection;