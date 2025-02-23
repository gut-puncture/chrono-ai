//pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import { authOptions } from "./authOptions";

export default NextAuth(authOptions);
