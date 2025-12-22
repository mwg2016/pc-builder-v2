import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StepCard from "../components/StepCard";

export default function AddSteps({ steps, onAdd, onRemove, onUpdate, onDragEnd }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <s-section padding="none" maxWidth="1000px" margin="auto">
      <s-stack direction="inline" justifyContent="space-between" padding="base" alignItems="center">
        <s-heading>Steps ({steps.length})</s-heading>
        <s-button variant="primary" onClick={onAdd}>
          Add Step
        </s-button>
      </s-stack>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={onDragEnd}
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
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </s-stack>
        </SortableContext>
      </DndContext>
    </s-section>
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
    <s-slack ref={setNodeRef} style={style}>
      <StepCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </s-slack>
  );
}