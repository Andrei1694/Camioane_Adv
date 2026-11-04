import type { RefObject } from 'react'
import { useAdminAccess } from '../../../auth/adminAccess'
import { plural } from '../../../lib/format'
import { plateKey } from '../car'
import type { Car } from '../car'

/** The driver's email from the admin user list, a dash for none, or a note once the account is gone. */
function DriverLabel({ driverId }: { driverId: string | null }) {
  const access = useAdminAccess()
  if (driverId === null) return <span className="missing">—<span className="sr-only">No driver</span></span>
  const driver = access.users.find((user) => user.id === driverId)
  if (!driver) return <span className="missing">Account not found</span>
  return (
    <span className="driver-email">
      {driver.email}{driver.role !== 'DRIVER' && <span className="unit"> (no longer a driver)</span>}
    </span>
  )
}

interface AddedCarsProps {
  /** Newest first. */
  cars: readonly Car[]
  headingRef: RefObject<HTMLHeadingElement | null>
  onRemove: (car: Car) => void
}

export default function AddedCars({ cars, headingRef, onRemove }: AddedCarsProps) {
  return (
    <section className="added-cars" aria-labelledby="added-cars-title">
      {/* Focus lands here after a removal, because the row's button is gone. */}
      <h2 id="added-cars-title" ref={headingRef} tabIndex={-1}>Added on this page</h2>
      {cars.length === 0 ? <p className="empty-state">No cars added yet.</p> : (
        <div className="cars-frame">
          <table className="cars-table">
            <caption>{plural(cars.length, 'car')}, newest first</caption>
            <thead>
              <tr>
                <th className="col-plate" scope="col">Plate</th>
                <th scope="col">Make and model</th>
                <th className="col-driver" scope="col">Driver</th>
                <th className="col-actions" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={plateKey(car.plate)}>
                  <th className="plate" scope="row">{car.plate}</th>
                  <td className="model-cell">
                    {car.model || <span className="missing">—<span className="sr-only">No make or model</span></span>}
                  </td>
                  <td className="driver-cell"><span className="stack-label">Driver </span><DriverLabel driverId={car.driverId} /></td>
                  <td className="actions-cell">
                    <button className="text-button danger" type="button" onClick={() => onRemove(car)}>
                      Remove<span className="sr-only"> {car.plate}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
