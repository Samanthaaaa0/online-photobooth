import React, { useEffect, useRef } from "react";

// 1. Strictly define the component's props interface
interface PopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Popup: React.FC<PopupProps> = ({
  isOpen,
  onClose,
  title = "Notification",
  children,
}) => {
  // 2. Strongly type the dialog reference
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // 3. Synchronize React state with the native DOM dialog element APIs
  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;

    if (isOpen) {
      // Prevents re-calling if already open
      if (!dialogElement.open) {
        dialogElement.showModal(); 
      }
    } else {
      if (dialogElement.open) {
        dialogElement.close();
      }
    }
  }, [isOpen]);

  // 4. Close the pop-up if the user clicks outside the content box onto the backdrop
  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose} // Fires natively if user presses the "Esc" key
      onClick={handleBackdropClick}
      className="popup-modal"
    >
      <div className="popup-content">
        <header className="popup-header">
          <h2>{title}</h2>
          <button 
            onClick={onClose} 
            className="btn-close-icon" 
            aria-label="Close modal"
          >
            &times;
          </button>
        </header>
        
        <main className="popup-body">
          {children}
        </main>
      </div>
    </dialog>
  );
};
