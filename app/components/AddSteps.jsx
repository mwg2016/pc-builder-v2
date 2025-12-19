import React, { useState, useEffect } from "react";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react"; // Import App Bridge components
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StepCard from "../components/StepCard";

export default function AddSteps({ widgetId }) {
  const shopify = useAppBridge(); // Initialize App Bridge

  // 1. "initialSteps" keeps the snapshot of the last saved state
  const [initialSteps, setInitialSteps] = useState([
    { id: "1", title: "Select Processor (CPU)", collection: "Processors", collectionId: "" },
    { id: "2", title: "Select Motherboard", collection: "Motherboards", collectionId: "" },
  ]);

  // 2. "steps" is the working state the user interacts with
  const [steps, setSteps] = useState(initialSteps);
  const [isDirty, setIsDirty] = useState(false);

  // 3. Automatically detect changes
  useEffect(() => {
    const hasChanges = JSON.stringify(steps) !== JSON.stringify(initialSteps);
    setIsDirty(hasChanges);
    
    // Optional: Auto-show if you want it to appear immediately on change
    if (hasChanges) {
        shopify.saveBar.show('my-save-bar');
    } else {
        shopify.saveBar.hide('my-save-bar');
    }

  }, [steps, initialSteps, shopify]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAddStep = () => {
    const newId = Date.now().toString();
    setSteps([...steps, { id: newId, title: "", collection: "", collectionId: "" }]);
  };

  const handleRemoveStep = (idToRemove) => {
    setSteps(steps.filter((step) => step.id !== idToRemove));
  };

  const updateStep = (id, updates) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // 4. Revert to original state
  const handleDiscard = () => {
    console.log('Discarding');
    setSteps(initialSteps); // Revert data
    shopify.saveBar.hide('my-save-bar'); // Hide bar
  };

  // 5. Commit changes
  const handleSave = () => {
    console.log('Saving');
    setInitialSteps(steps); // Update "Saved" reference
    shopify.saveBar.hide('my-save-bar'); // Hide bar
  };

  return (
    <s-page narrowwidth>
      {/* APP BRIDGE SAVE BAR 
         We render it conditionally or always, but "isDirty" logic controls its behavior.
         Since we are using imperative .show()/.hide() in useEffect, we can keep it rendered.
      */}
      <SaveBar id="my-save-bar">
        <button variant="primary" onClick={handleSave}>Save</button>
        <button onClick={handleDiscard}>Discard</button>
      </SaveBar>

      <s-section padding="none" maxWidth="1000px" margin="auto">
        <s-stack direction="inline" justifyContent="space-between" padding="base" alignItems="center">
          <s-heading>Steps ({steps.length})</s-heading>
          <s-button variant="primary" onClick={handleAddStep}>
            Add Step
          </s-button>
        </s-stack>

        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={steps.map(s => s.id)} 
            strategy={verticalListSortingStrategy}
          >
            <s-stack direction="block" gap="base" padding="base">
              {steps.map((step, index) => (
                <SortableStepWrapper
                  key={step.id}
                  step={step}
                  index={index}
                  onUpdate={updateStep}
                  onRemove={handleRemoveStep}
                />
              ))}
            </s-stack>
          </SortableContext>
        </DndContext>
      </s-section>
    </s-page>
  );
}

function SortableStepWrapper(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : "auto",
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StepCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}