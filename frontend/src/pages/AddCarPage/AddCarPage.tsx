import { useEffect, useRef, useState } from 'react'
import { useAdminAccess } from '../../auth/adminAccess'
import type { Car } from './car'
import AddedCars from './components/AddedCars'
import CarForm from './components/CarForm'
import './AddCarPage.css'

// The backend has no fleet API yet, so added cars live in this page's state and are gone once it
// unmounts. When the API exists, add the car through a TanStack Query mutation instead.
export default function AddCarPage() {
  const access = useAdminAccess()
  const [cars, setCars] = useState<Car[]>([])
  const [message, setMessage] = useState('')
  const listHeading = useRef<HTMLHeadingElement>(null)
  const drivers = access.users.filter((user) => user.role === 'DRIVER').toSorted((a, b) => a.email.localeCompare(b.email))

  useEffect(() => {
    // A rendered <title> would adopt index.html's title element and delete it on unmount.
    const previous = document.title
    document.title = 'Add car · Camioane App'
    return () => { document.title = previous }
  }, [])

  function handleAdd(car: Car) {
    setCars((current) => [car, ...current])
    setMessage(`Added ${car.plate}.`)
  }

  function handleRemove(car: Car) {
    setCars((current) => current.filter((item) => item !== car))
    setMessage(`Removed ${car.plate}.`)
    listHeading.current?.focus()
  }

  return (
    <section className="add-car-page">
      <header>
        <h1 id="add-car-title">Add car</h1>
        <p className="page-description">
          Record a car by its plate, make and model, and driver. Cars can't be saved yet, so the ones you add stay on this page until you leave or reload it.
        </p>
      </header>
      <p className="status-message" role="status" aria-atomic="true">{message}</p>
      <CarForm cars={cars} drivers={drivers} labelledBy="add-car-title" onAdd={handleAdd} />
      <AddedCars cars={cars} headingRef={listHeading} onRemove={handleRemove} />
    </section>
  )
}
