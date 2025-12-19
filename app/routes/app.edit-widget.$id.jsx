import { useParams } from "react-router";
import AddSteps from "../components/AddSteps"

export default function EditWidget() {
  const { id } = useParams();

  return <AddSteps widgetId={id}/>;
}
