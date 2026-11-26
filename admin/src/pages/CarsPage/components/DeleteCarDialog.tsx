import DeleteConfirmationDialog from '../../../components/DeleteConfirmationDialog'
import type { Car } from '../../../lib/car'

export default function DeleteCarDialog({ car, ...props }: {
  car: Car, onCancel: () => void, onDelete: () => void,
  pending: boolean, error: string, missing: boolean,
}) {
  return <DeleteConfirmationDialog {...props} title={`Ștergi mașina ${car.plate}?`}
    description="Mașina va fi ștearsă definitiv din inventarul comun al flotei." deleteLabel="Șterge mașina" />
}
