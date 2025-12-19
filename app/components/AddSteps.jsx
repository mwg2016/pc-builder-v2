import React, { useState } from "react";
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
import StepCard from "../components/StepCard"; // Ensure this path matches your folder structure

export default function AddSteps({ widgetId }) {
  const [steps, setSteps] = useState([
    { id: 1, title: "Select Processor (CPU)", collection: "Processors", collectionId: "", isUnsaved: false },
    { id: 2, title: "Select Motherboard", collection: "Motherboards", collectionId: "", isUnsaved: false },
  ]);

  // 1. Configure sensors (prevents accidental drags when clicking inputs)
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: { distance: 5 }, 
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddStep = () => {
    const newId = Date.now(); // Unique ID required for drag keys
    setSteps([
      ...steps,
      { id: newId, title: "", collection: "", collectionId: "", isUnsaved: true },
    ]);
  };

  const handleRemoveStep = (idToRemove) => {
    setSteps(steps.filter((step) => step.id !== idToRemove));
  };

  const updateStep = (id, updates) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => (step.id === id ? { ...step, ...updates, isUnsaved: true } : step))
    );
  };

  const handleSaveStep = (id) => {
    console.log("Saving step:", id);
    setSteps((prevSteps) =>
      prevSteps.map((step) => (step.id === id ? { ...step, isUnsaved: false } : step))
    );
  };

  // 2. Handle the reordering logic
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

  return (
    <s-page narrowwidth>
      <s-section padding="none" maxWidth="1000px" margin="auto">
        <s-stack direction="inline" justifyContent="space-between" padding="base" alignItems="center">
          <s-heading>Steps ({steps.length})</s-heading>
          <s-button variant="primary" onClick={handleAddStep}>
            Add Step
          </s-button>
        </s-stack>

        {/* 3. Wrap list in DndContext and SortableContext */}
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
                  onSave={handleSaveStep}
                />
              ))}
            </s-stack>
          </SortableContext>
        </DndContext>

      </s-section>
    </s-page>
  );
}

// --- Helper Component (Keep this in this file) ---
function SortableStepWrapper(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : "auto", 
    position: "relative",
  };

  // Pass the drag listeners down to the StepCard via `dragHandleProps`
  return (
    <div ref={setNodeRef} style={style}>
      <StepCard 
        {...props} 
        dragHandleProps={{ ...attributes, ...listeners }} 
      />
    </div>
  );
}