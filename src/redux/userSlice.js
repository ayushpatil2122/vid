import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    id: null,
    firstname: "",
    lastname: "",
    email: "",
    role: "",
    token: null,
  },
  reducers: {
    setUser: (state, action) => {
      return { ...state, ...action.payload };
    },
    clearUser: (state) => {
      return { id: null, firstname: "", lastname: "", email: "", role: "", token: null };
    },
  },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;