type userVarT = {
  _id: string
  role: "user"
  isBlocked: boolean
  isDeleted: boolean
  currentPlan: {
    _id: string
    subscribedTo: string
    expiryDate: string
    noOfProfilesCanView: number
  }
}

type adminVarT = {
  _id: string
  role: "admin" | "super-admin"
  isDeleted: boolean
}

type Env = {
  Variables: {
    user: userVarT | adminVarT
  }
}
